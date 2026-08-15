# Changelog

## 0.1.3 — 2026-08-15

- Remove unintended horizontal overflow from the Save/Edit footer in the
  compact popup.
- Hide browser-native scrollbar tracks in the Save/Edit view while preserving
  wheel, touch, and keyboard scrolling.

## 0.1.2 — 2026-08-13

- Allow recognized private and local-network HTTP instances only after the user
  explicitly acknowledges that credentials and link data will be unencrypted.
- Keep HTTPS as the default and continue rejecting plaintext HTTP for public or
  unrecognized remote hosts.
- Request Firefox host permissions without a port, which Firefox match patterns
  do not support, while retaining the exact configured port in Chromium.
- Replace the opaque Axios `Network Error` with checks for browser certificate
  warnings, host, port, and reverse-proxy reachability.

## 0.1.1 — 2026-08-12

- Refresh production and build dependencies to versions with no known npm
  advisories and regenerate the Chrome and Firefox packages.
- Replace the never-published Chrome `0.1.0` draft package with a version that
  the Web Store accepts as a newer upload.
- Publish the initial signed Firefox release through AMO.

## 0.1.0 — unpublished draft

- Introduce the Tagwarden identity and tag-first single-popup workflow.
- Adopt the linked-tags icon selected for the product identity and reuse it in
  the popup header for consistent Chrome and Firefox branding.
- Save new pages and edit existing Linkwarden links in one form.
- Add tag creation, rename, merge, deletion, and impact confirmation.
- Add local domain rules and usage-based tag suggestions.
- Add multi-tab batch saving and library search by intersecting tags.
- Add integrated connection, collection, theme, and rule settings.
- Produce separate Manifest V3 builds for Chrome-family browsers and Firefox.
- Replace broad host access with permission requested for the configured
  Linkwarden origin.
- Remove background Linkwarden lookups during ordinary browsing.
- Normalize access tokens copied with a `Bearer` prefix, keep rejected values
  locally as unverified instead of silently discarding them, and show the HTTP
  or network error beside the connection controls.
- Never persist account passwords; password sign-in stores only the session
  token returned by Linkwarden and avoids creating throwaway sessions through
  the separate Test action.
- Disable Vite's extension-page `modulepreload` output to avoid Chromium
  cross-world resource mismatch warnings, and use the Tagwarden title and icon
  in both popup and options HTML.
