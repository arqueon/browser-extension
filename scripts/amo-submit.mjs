#!/usr/bin/env node

import { createHmac, randomUUID } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const apiBase = new URL('https://addons.mozilla.org/api/v5/');
const projectDir = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(
  await readFile(path.join(projectDir, 'package.json'), 'utf8')
);
const version = packageJson.version;
const metadataPath = path.join(projectDir, 'docs', 'amo', 'metadata.json');
const privacyPath = path.join(projectDir, 'PRIVACY.md');
const uploadStatePath = path.join(projectDir, 'dist', `amo-upload-${version}.json`);
const submissionStatePath = path.join(
  projectDir,
  'dist',
  `amo-submission-${version}.json`
);
const sourcePath = path.join(
  projectDir,
  'dist',
  `tagwarden-source-${version}-amo.zip`
);
const addonGuid = 'tagwarden@arqueon.dev';
const submissionGatePath = path.join(
  projectDir,
  '.sdocs',
  `compuerta-api-firefox-amo-${version}.md`
);
const publicationGatePath = path.join(
  projectDir,
  '.sdocs',
  `aclaracion-publicacion-automatica-firefox-amo-${version}.md`
);

const command = process.argv[2] || '--dry-run';
if (!new Set(['--dry-run', '--check-reviewer', '--submit']).has(command)) {
  throw new Error('Expected --dry-run, --check-reviewer, or --submit.');
}

const base64url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');

async function keyringJson(service) {
  const { stdout } = await execFile(
    'secret-tool',
    ['lookup', 'service', service, 'account', 'default'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 }
  );
  return JSON.parse(stdout.trim());
}

async function loadApiCredentials() {
  const credentials = await keyringJson('tagwarden-amo');
  if (
    typeof credentials.issuer !== 'string' ||
    !credentials.issuer.startsWith('user:') ||
    typeof credentials.secret !== 'string' ||
    credentials.secret.length < 16
  ) {
    throw new Error('The AMO API credentials in the keyring are invalid.');
  }
  return credentials;
}

async function loadReviewerAccount() {
  const account = await keyringJson('tagwarden-amo-reviewer');
  if (
    typeof account.instanceUrl !== 'string' ||
    !account.instanceUrl.startsWith('https://') ||
    typeof account.username !== 'string' ||
    !account.username ||
    typeof account.password !== 'string' ||
    account.password.length < 8
  ) {
    throw new Error('The AMO reviewer account in the keyring is invalid.');
  }
  return account;
}

function createToken({ issuer, secret }) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: issuer,
      jti: randomUUID(),
      iat: issuedAt,
      exp: issuedAt + 60,
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

async function apiRequest(endpoint, options = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const credentials = await loadApiCredentials();
    const headers = new Headers(options.headers);
    headers.set('Authorization', `JWT ${createToken(credentials)}`);
    const response = await fetch(new URL(endpoint, apiBase), {
      ...options,
      headers,
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_error) {
      body = { detail: text };
    }
    if (response.ok) return body;
    if (response.status === 429 && attempt < 3) {
      const headerSeconds = Number.parseInt(
        response.headers.get('retry-after') || '',
        10
      );
      const detailSeconds = Number.parseInt(
        String(body?.detail || '').match(/(\d+) seconds?/u)?.[1] || '',
        10
      );
      const seconds = Number.isFinite(headerSeconds)
        ? headerSeconds
        : Number.isFinite(detailSeconds)
          ? detailSeconds
          : 60;
      console.error(
        `AMO throttled the request; retrying in ${seconds + 1} seconds.`
      );
      await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
      continue;
    }
    const error = new Error(
      `AMO API ${response.status}: ${JSON.stringify(body)}`
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }
  throw new Error('AMO request retry limit reached.');
}

async function jsonRequest(endpoint, method, body) {
  return apiRequest(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function optionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function recordState(state) {
  state.updatedAt = new Date().toISOString();
  await writeFile(submissionStatePath, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function assertFile(filePath) {
  const details = await stat(filePath);
  if (!details.isFile() || details.size === 0) {
    throw new Error(`Required file is empty or missing: ${filePath}`);
  }
}

async function assertAuthorization() {
  const [submissionGate, publicationGate] = await Promise.all([
    readFile(submissionGatePath, 'utf8'),
    readFile(publicationGatePath, 'utf8'),
  ]);
  const submitDecision =
    `decision: Enviar Tagwarden ${version} como nueva versión de la ficha existente a revisión`;
  const publicationDecision =
    'decision: Autorizar el envío y aceptar la publicación automática cuando AMO la determine';
  if (!submissionGate.includes(`answers:\n  ${submitDecision}`)) {
    throw new Error('The AMO review submission gate is not authorized.');
  }
  if (!publicationGate.includes(`answers:\n  ${publicationDecision}`)) {
    throw new Error('The AMO automatic-publication gate is not authorized.');
  }
}

const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
const uploadState = JSON.parse(await readFile(uploadStatePath, 'utf8'));
await Promise.all([
  assertFile(sourcePath),
]);
await assertAuthorization();

const prepared = {
  mode: command === '--submit' ? 'submission' : 'dry-run',
  version,
  slug: metadata.slug,
  guid: addonGuid,
  uploadUuid: uploadState.uuid,
  uploadValid: uploadState.valid,
  uploadSubmitted: uploadState.submitted,
  categories: metadata.categories,
  license: metadata.version?.license,
  assets: {
    source: path.relative(projectDir, sourcePath),
  },
  authorization: {
    reviewSubmission: true,
    automaticPublication: true,
  },
};

if (command === '--dry-run') {
  console.log(JSON.stringify(prepared, null, 2));
  process.exit(0);
}

const reviewer = await loadReviewerAccount();
if (command === '--check-reviewer') {
  const response = await fetch(`${reviewer.instanceUrl}/api/v1/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: reviewer.username,
      password: reviewer.password,
      sessionName: 'AMO Reviewer Credential Check',
    }),
  });
  const body = await response.json().catch(() => ({}));
  const token =
    (typeof body?.response === 'string' && body.response) ||
    body?.response?.token ||
    body?.response?.secretKey;
  if (!response.ok || typeof token !== 'string' || !token) {
    throw new Error(
      `Reviewer account check failed with HTTP ${response.status}. ` +
        'Re-enter the fictitious reviewer credentials.'
    );
  }
  console.log(
    JSON.stringify(
      {
        mode: 'reviewer-account-check',
        instance: new URL(reviewer.instanceUrl).host,
        username: reviewer.username,
        authenticated: true,
        credentialExposed: false,
      },
      null,
      2
    )
  );
  process.exit(0);
}

const site = await apiRequest('site/');
if (site?.read_only) {
  throw new Error(`AMO is read-only: ${site.notice || 'no site notice provided'}`);
}

const addonEndpoint = `addons/addon/${encodeURIComponent(addonGuid)}/`;
const addon = await apiRequest(addonEndpoint);
if (addon.guid !== addonGuid || addon.is_disabled) {
  throw new Error(
    `The existing AMO listing is not available for update: ${JSON.stringify({
      guid: addon.guid,
      status: addon.status,
      isDisabled: addon.is_disabled,
    })}`
  );
}

let state = await optionalJson(submissionStatePath);
if (state && state.version !== version) {
  throw new Error(
    `Submission state belongs to ${state.version}, not ${version}: ${submissionStatePath}`
  );
}
state ||= {
  version,
  addon: {
    id: addon.id,
    guid: addon.guid,
    slug: addon.slug,
    statusBeforeSubmission: addon.status,
    currentVersionBeforeSubmission: addon.current_version?.version,
    url: addon.url,
    editUrl: addon.edit_url,
  },
  steps: {
    addonConfirmed: true,
    versionCreated: false,
    sourceUploaded: false,
    privacyPolicySet: false,
  },
};

const versionCollectionEndpoint = `${addonEndpoint}versions/`;
const versionEndpoint = `${versionCollectionEndpoint}v${version}/`;

if (!state.steps.versionCreated) {
  const remoteUpload = await apiRequest(`addons/upload/${uploadState.uuid}/`);
  if (!remoteUpload.processed || !remoteUpload.valid) {
    throw new Error(
      `Upload ${uploadState.uuid} is not available for submission: ` +
        JSON.stringify({
          processed: remoteUpload.processed,
          valid: remoteUpload.valid,
          submitted: remoteUpload.submitted,
        })
    );
  }

  if (remoteUpload.submitted) {
    const existingVersion = await apiRequest(versionEndpoint);
    if (existingVersion.version !== version) {
      throw new Error(
        `Upload ${uploadState.uuid} is already submitted, but AMO does not report version ${version}.`
      );
    }
    state.version = {
      id: existingVersion.id,
      version: existingVersion.version,
      fileStatus: existingVersion.file?.status,
    };
  } else {
    const approvalNotes = [
      metadata.version.approval_notes,
      '',
      'Private reviewer account:',
      `Instance URL: ${reviewer.instanceUrl}`,
      `Username: ${reviewer.username}`,
      `Password: ${reviewer.password}`,
    ].join('\n');
    const created = await jsonRequest(
      versionCollectionEndpoint,
      'POST',
      {
        upload: uploadState.uuid,
        license: metadata.version.license,
        approval_notes: approvalNotes,
        compatibility: ['firefox', 'android'],
        release_notes: {
          'en-US':
            'Adds support for private and local-network Linkwarden instances. HTTPS remains the default; recognized private HTTP instances require an explicit warning and opt-in. Also improves Firefox host-permission handling and network diagnostics.',
        },
      }
    );
    state.version = {
      id: created.id,
      version: created.version,
      fileStatus: created.file?.status,
    };
  }
  state.steps.versionCreated = true;
  await recordState(state);
}

if (!state.steps.sourceUploaded) {
  const sourceForm = new FormData();
  sourceForm.set(
    'source',
    new Blob([await readFile(sourcePath)], { type: 'application/zip' }),
    path.basename(sourcePath)
  );
  await apiRequest(versionEndpoint, { method: 'PATCH', body: sourceForm });
  state.steps.sourceUploaded = true;
  await recordState(state);
}

if (!state.steps.privacyPolicySet) {
  const privacyPolicy = await readFile(privacyPath, 'utf8');
  await jsonRequest(
    `${addonEndpoint}eula_policy/`,
    'PATCH',
    { privacy_policy: { 'en-US': privacyPolicy } }
  );
  state.steps.privacyPolicySet = true;
  await recordState(state);
}

const [updatedAddon, submittedVersion, policy] = await Promise.all([
  apiRequest(addonEndpoint),
  apiRequest(versionEndpoint),
  apiRequest(`${addonEndpoint}eula_policy/`),
]);

state.verified = {
  addonStatus: updatedAddon.status,
  version: submittedVersion.version,
  versionStatus: submittedVersion.file?.status,
  sourceAttached: Boolean(submittedVersion.source),
  privacyPolicyAttached: Boolean(policy?.privacy_policy),
};
state.completed = Object.values({
  addonConfirmed: state.steps.addonConfirmed,
  versionCreated: state.steps.versionCreated,
  sourceUploaded: state.steps.sourceUploaded,
  privacyPolicySet: state.steps.privacyPolicySet,
}).every(Boolean);
await recordState(state);

console.log(
  JSON.stringify(
    {
      mode: 'submission-complete',
      version,
      addon: state.addon,
      steps: state.steps,
      verified: state.verified,
      completed: state.completed,
      statePath: submissionStatePath,
    },
    null,
    2
  )
);
