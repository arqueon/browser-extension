# Store listing draft — Tagwarden 0.1.2

This is publication copy, not evidence that either store submission has been
made.

## Identity

- **Name:** Tagwarden — Tags for Linkwarden
- **Short name:** Tagwarden
- **Recommended Chrome category:** Workflow & Planning (inside the
  Productivity group)
- **Recommended Firefox category:** Bookmarks
- **Relationship disclosure:** Independent community project; not affiliated
  with or endorsed by Linkwarden.
- **Icon:** two linked tags on a navy field, with cyan and almagre outlines;
  compatible with Linkwarden's visual language but compositionally distinct.

## Short description

Save, edit, organize, and find Linkwarden links with tags at the center.

## Full description

Tagwarden turns Linkwarden into a tag-first browser workflow. Save a page or
edit an existing link without leaving the popup, select or create tags first,
and reuse local suggestions based on the current domain and your own history.

The same window includes a complete tag manager, Linkwarden library search by
one or several tags, batch saving for selected tabs, connection settings, a
default collection, and light or dark appearance.

Tagwarden has no analytics, ads, telemetry, or maintainer-operated server. It
connects only to the Linkwarden instance you configure. A Linkwarden account or
self-hosted instance is required.

This is an independent community project and is not affiliated with or
endorsed by Linkwarden.

## Permission justifications

- **storage:** keeps the chosen instance, API token, preferences, domain rules,
  and local tag-suggestion history.
- **tabs:** shows the current window's tabs when the user opens Batch Save.
- **activeTab and scripting:** support saving the active page and the optional,
  user-selected screenshot feature.
- **contextMenus:** opens Save/Edit or Batch Save from the browser menu.
- **optional host access:** requested only for the configured Linkwarden host.
  Chromium keeps the exact port; Firefox grants the selected scheme and host
  without a port because its match patterns do not support ports.

## Data disclosure

Tagwarden transmits authentication information, URLs/domains, page titles,
user-entered tags and notes, searches, and optional screenshots only to the
user-selected Linkwarden instance. Domain rules and suggestion history remain
local. See `PRIVACY.md`.

HTTPS remains the default. Recognized private or local-network HTTP instances
work only after the user accepts an explicit warning that authentication and
link data will travel without transport encryption. Public or unrecognized
remote HTTP hosts remain blocked.

For Firefox, the manifest declares `authenticationInfo`, `browsingActivity`,
and `websiteContent` as required data-collection permissions because those
transmissions are necessary for the extension's primary, user-invoked purpose.

## Assets still required before submission

- At least three current screenshots showing Save/Edit, tag management, and
  batch/library workflows.
- Chrome promotional tile(s) in the exact dashboard dimensions.
- Final public repository and privacy-policy URLs.
- A private reviewer test account or reproducible local test instructions for
  Firefox AMO review.

The linked-tags icon was selected through a recorded visual gate and is already
present in the Chrome and Firefox packages as well as the popup header.

## Firefox validator note

Mozilla's linter may report `UNSAFE_VAR_ASSIGNMENT` inside the bundled
ReactDOM runtime. Tagwarden does not use `innerHTML` or
`dangerouslySetInnerHTML` in its source; the flagged code is React's standard
DOM implementation. Submit the matching source archive and these build
instructions so reviewers can verify that provenance.

## Publication gate

Before uploading, confirm the final product name and trademark review, public
URLs, maintainer contact, store accounts, reviewer credentials, screenshots,
and explicit authorization to submit each package.
