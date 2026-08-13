# AMO reviewer build instructions — Tagwarden 0.1.2

The submitted source archive already contains the complete source tree for this
version. Extract it into an empty directory and run the commands below from its
root. Do not clone another repository to review this submission.

## Build environment

The project is compatible with Mozilla's default reviewer environment:

- Ubuntu 24.04 LTS
- Node.js 24.14.0
- npm 11.9.0

The package also supports Node.js 20.19 or newer maintained releases. All
dependencies are resolved through the official npm registry and pinned by
`package-lock.json`. There are no required environment variables, credentials,
network services, or generated files outside the archive.

## Reproduce the Firefox build

```bash
npm ci
npm test
npm run lint
npm run build:firefox
```

The unpacked extension is produced in `dist/firefox`. Its `manifest.json` is
created from `manifest.firefox.json` by `scripts/finalize-build.mjs`.

To create a ZIP for comparison with the submitted extension package:

```bash
cd dist/firefox
zip -q -r ../tagwarden-firefox-0.1.2-rebuilt.zip .
```

ZIP metadata such as entry timestamps may differ. Compare the extracted files
or their individual hashes rather than the ZIP container hash.

## Bundled-code validator warning

The distributed JavaScript is bundled by Vite. Mozilla's validator may report
`UNSAFE_VAR_ASSIGNMENT` in the bundled ReactDOM runtime. Tagwarden source does
not call `innerHTML` or `dangerouslySetInnerHTML`; the matching source archive,
lockfile, and commands above allow reviewers to verify the bundled code's
provenance.
