#!/usr/bin/env node

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.MOCK_LINKWARDEN_PORT || '9777');
const extensionBuild = path.resolve(process.cwd(), 'dist/chrome');
const now = '2026-08-08T12:00:00.000Z';
const tags = [
  ['Accessibility', 18],
  ['Design systems', 11],
  ['Documentation', 32],
  ['Ideas', 24],
  ['Learning', 15],
  ['Open source', 21],
  ['Product research', 28],
  ['Read later', 46],
].map(([name, links], index) => ({
  id: index + 1,
  name,
  ownerId: 1,
  createdAt: now,
  updatedAt: now,
  _count: { links },
}));

const collections = [
  {
    id: 1,
    ownerId: 1,
    name: 'Research',
    color: '#8b5e3c',
    description: 'Fictitious review collection',
    isPublic: false,
    members: [],
    parent: null,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 2,
    ownerId: 1,
    name: 'Design references',
    color: '#657153',
    description: 'Fictitious review collection',
    isPublic: false,
    members: [],
    parent: { id: 1, name: 'Research' },
    parentId: 1,
    createdAt: now,
    updatedAt: now,
  },
];

const json = (response, body, status = 200) => {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    });
    response.end();
    return;
  }

  if (url.pathname === '/guide') {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(`<!doctype html>
      <html lang="en"><head><title>Designing accessible interfaces</title></head>
      <body><main><h1>Designing accessible interfaces</h1>
      <p>Fictitious page used only to produce Tagwarden store screenshots.</p>
      </main></body></html>`);
    return;
  }

  if (url.pathname === '/api/v1/config') {
    json(response, { response: { INSTANCE_VERSION: 'v2.15.0' } });
    return;
  }

  if (url.pathname === '/api/v1/collections') {
    json(response, { response: collections });
    return;
  }

  if (url.pathname === '/api/v1/tags') {
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const visibleTags = search
      ? tags.filter((tag) => tag.name.toLowerCase().includes(search))
      : tags;
    json(response, { data: { tags: visibleTags, nextCursor: null } });
    return;
  }

  if (url.pathname === '/api/v1/search') {
    json(response, { data: { links: [] } });
    return;
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const localPath = path.resolve(extensionBuild, `.${requestedPath}`);
  if (localPath.startsWith(`${extensionBuild}${path.sep}`)) {
    try {
      const body = await readFile(localPath);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes[path.extname(localPath)] ?? 'application/octet-stream',
      });
      response.end(body);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  json(response, { response: 'Not found' }, 404);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock Linkwarden listening on http://127.0.0.1:${port}`);
});
