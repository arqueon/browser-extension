# Tagwarden privacy notice

Effective date: 2026-08-08

Tagwarden is an independent browser companion for Linkwarden. It has no
telemetry, advertising, analytics, or developer-operated backend.

## Data handled

Tagwarden handles the following data only to provide its visible features:

- the URL and title of the active page or tabs explicitly selected for saving;
- tags, notes, collection choices, and search terms entered in Tagwarden;
- an optional page screenshot when the user enables that choice;
- the configured Linkwarden instance URL and API token;
- a username and password temporarily in memory when the user chooses password
  sign-in; the password is not persisted by Tagwarden;
- local tag-usage counts and user-defined domain suggestion rules.

## Where data goes

URLs, titles, tags, notes, searches, optional screenshots, and authentication
information are transmitted only to the Linkwarden instance chosen by the
user. Tagwarden does not transmit them to its maintainers or to another
third-party service.

The instance URL, API token, default collection, theme, domain rules, and tag
suggestion history are stored in the browser's local extension storage. They
are removed when the extension is uninstalled, subject to the browser's own
storage behavior.

## Permissions

- `storage`: configuration, domain rules, and local tag suggestions.
- `tabs`: list the current window's tabs for the visible batch-save feature.
- `activeTab` and `scripting`: read or capture the active page only for visible,
  user-initiated save and screenshot features.
- `contextMenus`: open Tagwarden from a page's context menu.
- Optional host access: connect only to the Linkwarden origin entered by the
  user.

Tagwarden does not query Linkwarden automatically as the user navigates. It
connects when the user opens or invokes a Tagwarden feature.

## Security and control

Remote Linkwarden instances must use HTTPS. Plain HTTP is accepted only for
localhost development. Users can revoke the optional site permission, clear
the extension's local storage, or uninstall Tagwarden at any time.

This repository does not accept secrets in issues. Security or privacy reports
should be sent privately to `arqueonautis@gmail.com`.

## Contact

For questions about this notice or Tagwarden's data handling, contact
`arqueonautis@gmail.com`.

## Changes

Material changes to this notice or to Tagwarden's data practices will be
documented with a version update before publication.
