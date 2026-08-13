#!/usr/bin/env bash

set -euo pipefail

for command_name in jq secret-tool zenity; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
done

issuer="$(
  zenity --entry \
    --title="Tagwarden · AMO API" \
    --text="Paste the JWT issuer shown on the AMO API credentials page (it starts with user:)." \
    --width=520
)"

# Clipboard selections can include accidental surrounding whitespace. AMO JWT
# issuers and secrets never contain it, so normalize only the edges.
issuer="${issuer#"${issuer%%[![:space:]]*}"}"
issuer="${issuer%"${issuer##*[![:space:]]}"}"

if [[ ! "${issuer}" =~ ^user:[0-9]+:[0-9]+$ ]]; then
  zenity --error --text="The issuer does not match the expected user:NUMBER:NUMBER format."
  exit 1
fi

secret="$(
  zenity --password \
    --title="Tagwarden · AMO API secret" \
    --text="Paste the JWT secret from the API credentials page, not your AMO account password."
)"

secret="${secret#"${secret%%[![:space:]]*}"}"
secret="${secret%"${secret##*[![:space:]]}"}"

if (( ${#secret} < 16 )); then
  zenity --error --text="The API secret is too short."
  exit 1
fi

payload="$(jq -nc --arg issuer "${issuer}" --arg secret "${secret}" '{issuer:$issuer,secret:$secret}')"
printf '%s' "${payload}" | secret-tool store \
  --label="Tagwarden AMO API" \
  service tagwarden-amo \
  account default

unset secret payload
zenity --info \
  --title="Tagwarden · AMO API" \
  --text="Credentials saved in the system keyring. They were not written to the repository."
