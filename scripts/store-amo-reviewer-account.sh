#!/usr/bin/env bash

set -euo pipefail

for command_name in jq secret-tool zenity; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
done

trim_edges() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

instance_url="$(
  zenity --entry \
    --title="Tagwarden · AMO reviewer account" \
    --text="Linkwarden test instance URL (fictitious reviewer data only)." \
    --entry-text="https://linkwarden.arqueonautis.org" \
    --width=560
)"
instance_url="$(trim_edges "${instance_url}")"
instance_url="${instance_url%/}"

if [[ ! "${instance_url}" =~ ^https:// ]]; then
  zenity --error --text="The reviewer instance must use HTTPS."
  exit 1
fi

username="$(
  zenity --entry \
    --title="Tagwarden · AMO reviewer account" \
    --text="Reviewer username (not your personal account)." \
    --entry-text="tagwarden-review" \
    --width=560
)"
username="$(trim_edges "${username}")"

if [[ -z "${username}" ]]; then
  zenity --error --text="The reviewer username cannot be empty."
  exit 1
fi

password="$(
  zenity --password \
    --title="Tagwarden · AMO reviewer password" \
    --text="Paste the password for the fictitious Linkwarden reviewer account."
)"

if (( ${#password} < 8 )); then
  zenity --error --text="The reviewer password is too short."
  exit 1
fi

payload="$(
  jq -nc \
    --arg instanceUrl "${instance_url}" \
    --arg username "${username}" \
    --arg password "${password}" \
    '{instanceUrl:$instanceUrl,username:$username,password:$password}'
)"

printf '%s' "${payload}" | secret-tool store \
  --label="Tagwarden AMO reviewer account" \
  service tagwarden-amo-reviewer \
  account default

unset password payload
zenity --info \
  --title="Tagwarden · AMO reviewer account" \
  --text="Reviewer account saved in the system keyring. It was not written to the repository."
