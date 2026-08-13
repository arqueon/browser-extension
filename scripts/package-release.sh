#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -p "require('${project_root}/package.json').version")"

for target in chrome firefox; do
  archive="${project_root}/dist/tagwarden-${target}-${version}.zip"
  rm -f "${archive}"
  (
    cd "${project_root}/dist/${target}"
    zip -q -r "${archive}" .
  )
done

source_archive="${project_root}/dist/tagwarden-source-${version}.zip"
rm -f "${source_archive}"
mapfile -t candidate_files < <(
  cd "${project_root}"
  git ls-files --cached --others --exclude-standard
)

source_files=()
for file in "${candidate_files[@]}"; do
  case "${file}" in
    .sdocs/*|assets/icon-proposals/*|dist/*|node_modules/*|safari/*|manifest.safari.json) continue ;;
  esac
  source_files+=("${file}")
done

(
  cd "${project_root}"
  zip -q "${source_archive}" "${source_files[@]}"
)

printf '%s\n' \
  "${project_root}/dist/tagwarden-chrome-${version}.zip" \
  "${project_root}/dist/tagwarden-firefox-${version}.zip" \
  "${project_root}/dist/tagwarden-source-${version}.zip"
