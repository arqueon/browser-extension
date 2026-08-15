# Tagwarden — Tags for Linkwarden

Tagwarden is an independent, community-built browser companion for
[Linkwarden](https://github.com/linkwarden/linkwarden). It puts tags at the
center of saving, editing, finding, and maintaining links without leaving one
compact popup.

> Tagwarden is not affiliated with or endorsed by the Linkwarden project. It
> requires a Linkwarden account or self-hosted instance.

Its linked-tags icon deliberately shares Linkwarden's dark, cyan visual
language while using a distinct two-tag composition and an almagre accent.
This signals compatibility without presenting Tagwarden as an official build.

## What makes it different

- Save a new page or edit an existing Linkwarden link in the same form.
- Choose, search, or create tags before saving; suggested tags appear first.
- Create, rename, merge, and delete tags in a dedicated manager with impact
  confirmation for destructive actions.
- Suggest tags from local usage history and explicit domain rules.
- Save several open tabs with one shared collection and tag set.
- Search the Linkwarden library by one or several tags; several tags use AND.
- Configure the instance, credentials, default collection, theme, and domain
  rules inside the popup.
- Build independent Manifest V3 packages for Chrome-family browsers and
  Firefox.

## Privacy and permissions

Tagwarden has no telemetry, ads, analytics, or developer-operated backend. It
communicates only with the Linkwarden instance configured by the user. Domain
rules and tag-suggestion history remain in local extension storage.

Host access is optional and requested only for the configured Linkwarden
origin. The `tabs` permission powers batch saving; `activeTab` and `scripting`
power the user-selected screenshot feature; `storage` keeps configuration and
local suggestions; `contextMenus` opens the relevant Tagwarden view.

HTTPS remains the default for every instance. Plain HTTP works automatically
only on loopback. For a recognized private or local-network address, Tagwarden
shows an explicit opt-in warning because credentials, URLs, notes, and tags can
travel without encryption. Public or unrecognized remote HTTP hosts remain
blocked. See [PRIVACY.md](PRIVACY.md) for the complete disclosure.

## Install a local build

### Chrome, Chromium, Brave, Edge, or Vivaldi

1. Download or build the Chrome package.
2. Open the browser's extensions page and enable **Developer mode**.
3. Choose **Load unpacked** and select `dist/chrome`.
4. Open Tagwarden, enter the Linkwarden URL and an API key, then test and save
   the connection.

### Firefox 140 or later

1. Download or build the Firefox package.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select `dist/firefox/manifest.json`.
4. Open Tagwarden and configure the Linkwarden connection.

Temporary Firefox installations disappear when Firefox restarts. A normal
installation requires a package signed by Mozilla.

## Build from source

Requirements:

- Node.js 20.19 or later, or Node.js 22.12 or later
- npm
- Git

```bash
git clone https://github.com/arqueon/browser-extension.git
cd browser-extension
npm ci
npm test
npm run lint
npm run build
```

The build produces:

- `dist/chrome`: Chrome-family unpacked extension
- `dist/firefox`: Firefox unpacked extension

Run one package only with `npm run build:chrome` or
`npm run build:firefox`.

Create both store ZIPs and the matching reviewer source archive with:

```bash
npm run package:release
```

## Release checks

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Firefox reviewers also require the source archive and reproducible build
instructions because the distributed JavaScript is bundled. The commands above
build entirely from the checked-in source and `package-lock.json`.

When reviewing the AMO source archive, use the self-contained instructions in
`AMO_BUILD.md`; the reviewer does not need to clone the public repository.

## Status

Tagwarden `0.1.2` is the current public Firefox release. Version `0.1.3`
removes unintended popup scrollbar tracks without disabling scrolling and was
submitted to the existing Firefox Add-ons listing on 2026-08-15. It remains
unreviewed while AMO serves `0.1.2`. Chrome remains on its separate review
track and was not changed by the Firefox submission.
Chrome-family browsers and Firefox are the v1 targets; the legacy upstream
Safari project is not part of the release package.

## Credits and license

Tagwarden began as a substantial fork of the official
[Linkwarden browser extension](https://github.com/linkwarden/browser-extension)
and retains its MIT license. See [LICENSE](LICENSE).
