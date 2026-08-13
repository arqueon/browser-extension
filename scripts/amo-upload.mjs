#!/usr/bin/env node

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

const apiBase = new URL('https://addons.mozilla.org/api/v5/');
const projectDir = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(
  await readFile(path.join(projectDir, 'package.json'), 'utf8')
);
const version = packageJson.version;
const extensionPath = path.join(
  projectDir,
  'dist',
  `tagwarden-firefox-${version}.zip`
);
const sourcePath = path.join(
  projectDir,
  'dist',
  `tagwarden-source-${version}-amo.zip`
);
const metadataPath = path.join(projectDir, 'docs', 'amo', 'metadata.json');
const statePath = path.join(projectDir, 'dist', `amo-upload-${version}.json`);
const credentialsPath =
  process.env.AMO_CREDENTIALS_FILE ||
  path.join(homedir(), '.config', 'tagwarden', 'amo-api.json');

const command = process.argv[2] || '--dry-run';
const allowedCommands = new Set([
  '--dry-run',
  '--check-credentials',
  '--inspect-upload',
  '--upload',
]);

if (!allowedCommands.has(command)) {
  throw new Error(
    'Expected --dry-run, --check-credentials, --inspect-upload, or --upload. This client does not implement submission.'
  );
}

const base64url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');

const sha256 = async (filePath) =>
  createHash('sha256').update(await readFile(filePath)).digest('hex');

async function inspectFile(filePath) {
  const details = await stat(filePath);
  return {
    path: path.relative(projectDir, filePath),
    bytes: details.size,
    sha256: await sha256(filePath),
  };
}

async function loadCredentials() {
  if (process.env.AMO_JWT_ISSUER && process.env.AMO_JWT_SECRET) {
    return {
      issuer: process.env.AMO_JWT_ISSUER,
      secret: process.env.AMO_JWT_SECRET,
    };
  }

  let credentials;
  try {
    const details = await stat(credentialsPath);
    if ((details.mode & 0o077) !== 0) {
      throw new Error(
        `Credential file permissions are too broad: ${credentialsPath}. Run chmod 600 on it.`
      );
    }
    credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    try {
      const { stdout } = await execFile(
        'secret-tool',
        ['lookup', 'service', 'tagwarden-amo', 'account', 'default'],
        { encoding: 'utf8', maxBuffer: 16 * 1024 }
      );
      credentials = JSON.parse(stdout.trim());
    } catch (_keyringError) {
      throw new Error(
        'AMO credentials were not found in the system keyring or protected credential file. Run scripts/store-amo-credentials.sh.'
      );
    }
  }

  if (
    typeof credentials.issuer !== 'string' ||
    !credentials.issuer.startsWith('user:') ||
    typeof credentials.secret !== 'string' ||
    credentials.secret.length < 16
  ) {
    throw new Error('The AMO credential file does not contain a valid issuer and secret.');
  }
  return credentials;
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

function publicValidation(message) {
  return {
    type: message.type,
    id: message.id,
    message: message.message,
    description: message.description,
    file: message.file,
    line: message.line,
    column: message.column,
  };
}

async function apiRequest(url, options = {}) {
  const credentials = await loadCredentials();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `JWT ${createToken(credentials)}`);
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_error) {
    body = { detail: text };
  }
  if (!response.ok) {
    throw new Error(
      `AMO API ${response.status}: ${JSON.stringify(body)}`
    );
  }
  return body;
}

const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
const local = {
  version,
  extension: await inspectFile(extensionPath),
  source: await inspectFile(sourcePath),
  metadata: {
    name: metadata.name?.['en-US'],
    category: metadata.categories?.firefox,
    license: metadata.version?.license,
  },
};

if (command === '--dry-run') {
  console.log(JSON.stringify({ mode: 'dry-run', submitted: false, ...local }, null, 2));
  process.exit(0);
}

if (command === '--check-credentials') {
  const profile = await apiRequest(new URL('accounts/profile/', apiBase));
  console.log(
    JSON.stringify(
      {
        mode: 'credential-check',
        submitted: false,
        profile: {
          id: profile.id,
          name: profile.name || profile.display_name || profile.username,
        },
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (command === '--inspect-upload') {
  const recorded = JSON.parse(await readFile(statePath, 'utf8'));
  if (typeof recorded.uuid !== 'string' || !recorded.uuid) {
    throw new Error(`Upload state does not contain a UUID: ${statePath}`);
  }
  const upload = await apiRequest(
    new URL(`addons/upload/${recorded.uuid}/`, apiBase)
  );
  console.log(
    JSON.stringify(
      {
        mode: 'upload-inspection',
        uuid: upload.uuid,
        processed: upload.processed,
        valid: upload.valid,
        submitted: upload.submitted,
        messages: (upload.validation?.messages || []).map(publicValidation),
      },
      null,
      2
    )
  );
  process.exit(0);
}

const form = new FormData();
form.set('channel', 'listed');
form.set(
  'upload',
  new Blob([await readFile(extensionPath)], { type: 'application/zip' }),
  path.basename(extensionPath)
);

const created = await apiRequest(new URL('addons/upload/', apiBase), {
  method: 'POST',
  body: form,
});
const uploadUrl = new URL(
  created.url || `addons/upload/${created.uuid}/`,
  apiBase
);
let upload = created;
const deadline = Date.now() + 120_000;

while (!upload.processed && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  upload = await apiRequest(uploadUrl);
}

if (!upload.processed) {
  throw new Error(`AMO validation did not finish within 120 seconds. Upload UUID: ${upload.uuid}`);
}
if (upload.submitted) {
  throw new Error(`Safety check failed: AMO reports upload ${upload.uuid} as submitted.`);
}

const counts = upload.validation?.messages?.reduce(
  (result, message) => {
    const key = message.type || 'unknown';
    result[key] = (result[key] || 0) + 1;
    return result;
  },
  {}
) || {};
const state = {
  recordedAt: new Date().toISOString(),
  uuid: upload.uuid,
  version: upload.version,
  channel: upload.channel,
  processed: upload.processed,
  valid: upload.valid,
  submitted: upload.submitted,
  validationCounts: counts,
  validationMessages: (upload.validation?.messages || []).map(publicValidation),
  extension: local.extension,
  source: local.source,
};

await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, {
  mode: 0o600,
});
console.log(JSON.stringify({ mode: 'upload-validation', statePath, ...state }, null, 2));
