#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "${script_dir}/.." && pwd)"
asset_dir="${project_dir}/store-assets"
icon_path="${project_dir}/public/128.png"

for command_name in rsvg-convert magick identify; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
done

cd "${asset_dir}"

rsvg-convert \
  -o chrome-screenshot-1280x800.base.png \
  chrome-screenshot-1280x800.svg
magick \
  chrome-screenshot-1280x800.base.png \
  "${icon_path}" \
  -geometry 78x78+72+64 \
  -composite \
  chrome-screenshot-1280x800.png

rsvg-convert \
  -o chrome-small-promo-440x280.base.png \
  chrome-small-promo-440x280.svg
magick \
  chrome-small-promo-440x280.base.png \
  "${icon_path}" \
  -geometry 80x80+32+34 \
  -composite \
  chrome-small-promo-440x280.png

rm -f \
  chrome-screenshot-1280x800.base.png \
  chrome-small-promo-440x280.base.png

identify \
  chrome-screenshot-1280x800.png \
  chrome-small-promo-440x280.png
