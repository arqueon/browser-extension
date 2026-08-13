#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

const port = Number(process.env.CDP_PORT || '9333');
const output = process.argv[2] || 'store-assets/popup-tag-picker.png';
const captureView = process.argv[3] || 'picker';
const isSettingsHttpView = captureView === 'settings-http';
const demoBaseUrl = isSettingsHttpView
  ? 'http://192.168.1.20:3000'
  : 'http://127.0.0.1:9777';
let nextId = 0;

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  return {
    close: () => socket.close(),
    async send(method, params = {}) {
      await ready;
      const id = ++nextId;
      const response = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      socket.send(JSON.stringify({ id, method, params }));
      return await response;
    },
  };
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const response = await fetch(`http://127.0.0.1:${port}/json/list`);
const targets = await response.json();
const pageTarget = targets.find(
  (target) =>
    target.type === 'page' &&
    !target.url.startsWith('chrome-extension://') &&
    !target.url.startsWith('chrome://')
);

if (!pageTarget) throw new Error('No regular Chromium page target was found.');

const client = connect(pageTarget.webSocketDebuggerUrl);
await client.send('Page.enable');
await client.send('Runtime.enable');
await client.send('Emulation.setDeviceMetricsOverride', {
  width: 420,
  height: 600,
  deviceScaleFactor: 1,
  mobile: false,
});
await client.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    globalThis.__tagwardenCaptureErrors = [];
    addEventListener('error', (event) => {
      globalThis.__tagwardenCaptureErrors.push(event.error?.stack ?? event.message);
    });
    addEventListener('unhandledrejection', (event) => {
      globalThis.__tagwardenCaptureErrors.push(event.reason?.stack ?? String(event.reason));
    });
    const store = {
      linkwarden_config: JSON.stringify({
        baseUrl: ${JSON.stringify(demoBaseUrl)},
        apiKey: 'fictitious-store-demo-key',
        connectionVerified: ${isSettingsHttpView ? 'false' : 'true'},
        allowInsecureHttp: false,
        defaultCollection: 'Research',
        defaultCollectionId: 1,
        syncBookmarks: false
      }),
      tagwarden_domain_rules: [
        { domain: 'design.example', tags: ['Accessibility', 'Product research'] }
      ],
      tagwarden_tag_usage: {
        documentation: {
          name: 'Documentation', count: 12, lastUsedAt: Date.now(),
          domains: { 'design.example': 4 }
        },
        'design systems': {
          name: 'Design systems', count: 9, lastUsedAt: Date.now() - 1000,
          domains: { 'design.example': 3 }
        }
      }
    };
    const storage = {
      get: async (keys) => {
        const wanted = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(wanted.filter((key) => key in store).map((key) => [key, store[key]]));
      },
      set: async (values) => Object.assign(store, values),
      remove: async (keys) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
      }
    };
    const mockChrome = globalThis.chrome ?? {};
    mockChrome.action = {
      setBadgeBackgroundColor: () => {},
      setBadgeText: () => {}
    };
    mockChrome.runtime = {
      id: 'tagwarden-store-capture',
      getURL: (value) => value,
      lastError: undefined
    };
    mockChrome.storage = { local: storage };
    mockChrome.tabs = {
      query: async () => [{
        id: 1,
        url: 'https://design.example/accessible-interfaces',
        title: 'Designing accessible interfaces'
      }]
    };
    globalThis.chrome = mockChrome;
  })();`,
});
await client.send('Page.navigate', { url: 'http://127.0.0.1:9777/index.html' });
await sleep(1800);

if (!isSettingsHttpView) {
  const ready = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const button = document.querySelector('button[aria-label="Select tags"]');
      if (!button) return {
        opened: false,
        text: document.body.innerText,
        html: document.querySelector('#root')?.innerHTML,
        errors: globalThis.__tagwardenCaptureErrors,
        scripts: [...document.scripts].map((script) => script.src)
      };
      button.click();
      return { opened: true };
    })()`,
    returnByValue: true,
  });

  if (!ready.result.value.opened) {
    throw new Error(`The tag selector was not available: ${JSON.stringify(ready.result.value)}`);
  }

  await sleep(700);
  for (const choice of ['Accessibility', 'Product research']) {
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const item = [...document.querySelectorAll('[role="option"]')]
          .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(choice)});
        if (item) item.click();
      })()`,
    });
    await sleep(220);
  }

  if (captureView === 'form') {
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const done = [...document.querySelectorAll('button')]
          .find((button) => button.textContent.trim() === 'Done');
        if (done) done.click();
      })()`,
    });
    await sleep(300);
  }
}

const screenshot = await client.send('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: 420, height: 600, scale: 1 },
});

client.close();
await writeFile(output, Buffer.from(screenshot.data, 'base64'));
console.log(output);
