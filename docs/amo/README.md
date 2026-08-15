# AMO API workflow

This workflow deliberately separates upload and validation from submitting a
new version to the existing listed add-on. The safe upload command never calls
the version-create endpoint.

## 1. Create API credentials

Sign in to AMO and create personal API credentials at:

<https://addons.mozilla.org/developers/addon/api/key/>

The preferred method is the system keyring. Run:

```bash
scripts/store-amo-credentials.sh
```

The helper opens two local dialogs and saves a single protected keyring item.
It does not print either value. As a fallback, a protected file can be stored
outside the repository in `~/.config/tagwarden/amo-api.json`:

```json
{
  "issuer": "user:12345:67",
  "secret": "replace-with-the-private-jwt-secret"
}
```

Restrict the file before using it:

```bash
chmod 600 ~/.config/tagwarden/amo-api.json
```

Never commit, paste, screenshot, or send these credentials in reviewer notes.

## 2. Prepare and inspect local artifacts

```bash
scripts/package-amo-source.sh
node scripts/amo-upload.mjs --dry-run
```

## 3. Check the AMO identity without uploading

```bash
node scripts/amo-upload.mjs --check-credentials
```

This performs an authenticated read of the AMO account profile.

## 4. Upload and validate without submission

```bash
node scripts/amo-upload.mjs --upload
```

The script uploads `dist/tagwarden-firefox-0.1.3.zip` to AMO's `listed`
validation channel, polls the validator, and stores a sanitized result in
`dist/amo-upload-0.1.3.json`. It exits with an error if AMO reports the upload
as already submitted.

The upload UUID is only an input for a later version-create request. Do not run
`web-ext sign --channel listed` while the publication gate remains closed:
that command submits a new listed version.

## 5. Submit the validated upload to the existing listing

After recording explicit authorization for review and AMO's possible automatic
publication in the version-specific SmallDocs gates, inspect and submit with:

```bash
node scripts/amo-submit.mjs --dry-run
node scripts/amo-submit.mjs --check-reviewer
node scripts/amo-submit.mjs --submit
```

The submit client verifies the existing `tagwarden@arqueon.dev` listing before
creating the version. It then attaches the reviewer source archive and updates
the privacy policy; it never creates another add-on listing.

## Prepared final metadata

`docs/amo/metadata.json` contains non-secret listing metadata for a later,
explicitly authorized submission. Reviewer account credentials are intentionally
excluded.
