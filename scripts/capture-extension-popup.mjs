#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

const port = Number(process.env.CDP_PORT || '9333');
const output = process.argv[2] || 'store-assets/popup.png';
const captureView = process.argv[3] || 'current';

let nextId = 0;

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return {
    ready,
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

async function targets() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Could not read CDP targets: ${response.status}`);
  return await response.json();
}

const isPopup = (target) =>
  target.type === 'page' &&
  target.url.startsWith('chrome-extension://') &&
  target.url.endsWith('/index.html');

const initialTargets = await targets();
let popupTarget = initialTargets.find(isPopup);

if (!popupTarget) {
  const worker = initialTargets.find(
    (target) =>
      target.type === 'service_worker' && target.url.endsWith('/background.js')
  );

  if (!worker) throw new Error('Tagwarden service worker target was not found.');

  const workerClient = connect(worker.webSocketDebuggerUrl);
  await workerClient.send('Runtime.enable');
  await workerClient.send('Runtime.evaluate', {
    expression: 'chrome.action.openPopup()',
    awaitPromise: true,
  });
  workerClient.close();

  await new Promise((resolve) => setTimeout(resolve, 800));
  popupTarget = (await targets()).find(isPopup);
}

popupTarget = (await targets()).find(
  (target) =>
    target.type === 'page' &&
    target.url.startsWith('chrome-extension://') &&
    target.url.endsWith('/index.html')
);

if (!popupTarget) throw new Error('Tagwarden popup target was not opened.');

const popupClient = connect(popupTarget.webSocketDebuggerUrl);
await popupClient.send('Page.enable');
await popupClient.send('Runtime.enable');
try {
  await popupClient.send('Emulation.setDeviceMetricsOverride', {
    width: 420,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
} catch (error) {
  // Chrome extension popups already have their CSS-defined viewport and some
  // Chromium versions reject metrics overrides for this top-level surface.
  if (!error.message.includes('does not support metrics override')) throw error;
}

if (captureView === 'form') {
  await popupClient.send('Runtime.evaluate', {
    expression: `(() => {
      const done = [...document.querySelectorAll('button')]
        .find((button) => button.textContent.trim().startsWith('Done'));
      if (done) done.click();
      return Boolean(done);
    })()`,
    returnByValue: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
}
await new Promise((resolve) => setTimeout(resolve, 500));

const screenshot = await popupClient.send('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: 420, height: 600, scale: 1 },
});

popupClient.close();
await writeFile(output, Buffer.from(screenshot.data, 'base64'));
console.log(output);
