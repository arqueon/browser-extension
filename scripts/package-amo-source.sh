#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "${script_dir}/.." && pwd)"
version="$(node -p "require('${project_dir}/package.json').version")"
archive="${project_dir}/dist/tagwarden-source-${version}-amo.zip"
temporary_archive="${archive}.tmp.zip"

mapfile -t candidate_files < <(
  cd "${project_dir}"
  git ls-files --cached --others --exclude-standard
)

source_files=()
for file in "${candidate_files[@]}"; do
  case "${file}" in
    .sdocs/*|assets/icon-proposals/*|dist/*|node_modules/*|safari/*|store-assets/*|manifest.safari.json) continue ;;
    scripts/capture-extension-popup.mjs|scripts/capture-store-demo.mjs|scripts/mock-linkwarden-server.mjs|scripts/prepare-store-demo.mjs) continue ;;
  esac
  source_files+=("${file}")
done

mkdir -p "${project_dir}/dist"
rm -f "${temporary_archive}"
(
  cd "${project_dir}"
  zip -q "${temporary_archive}" "${source_files[@]}"
)
mv "${temporary_archive}" "${archive}"

printf '%s\n' "${archive}"
sha256sum "${archive}"
