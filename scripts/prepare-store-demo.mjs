#!/usr/bin/env node

const port = Number(process.env.CDP_PORT || '9333');
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

async function targets() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Could not read CDP targets: ${response.status}`);
  return await response.json();
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const targetList = await targets();
const popupTarget = targetList.find(
  (target) =>
    target.type === 'page' &&
    target.url.startsWith('chrome-extension://') &&
    target.url.endsWith('/index.html')
);
const contentTarget = targetList.find(
  (target) => target.type === 'page' && !target.url.startsWith('chrome-extension://')
);

if (!popupTarget || !contentTarget) {
  throw new Error('The popup or content tab target was not found.');
}

const contentClient = connect(contentTarget.webSocketDebuggerUrl);
await contentClient.send('Page.enable');
await contentClient.send('Page.navigate', {
  url: 'http://127.0.0.1:9777/guide',
});
await sleep(600);
contentClient.close();

const popupClient = connect(popupTarget.webSocketDebuggerUrl);
await popupClient.send('Runtime.enable');
await popupClient.send('Page.enable');
await popupClient.send('Runtime.evaluate', {
  expression: `chrome.storage.local.set({
    linkwarden_config: JSON.stringify({
      baseUrl: 'http://127.0.0.1:9777',
      apiKey: 'fictitious-store-demo-key',
      connectionVerified: true,
      defaultCollection: 'Research',
      defaultCollectionId: 1,
      syncBookmarks: false
    }),
    tagwarden_domain_rules: [
      { domain: '127.0.0.1', tags: ['Accessibility', 'Product research'] }
    ],
    tagwarden_tag_usage: {
      documentation: {
        name: 'Documentation', count: 12, lastUsedAt: Date.now(),
        domains: { '127.0.0.1': 4 }
      },
      'design systems': {
        name: 'Design systems', count: 9, lastUsedAt: Date.now() - 1000,
        domains: { '127.0.0.1': 3 }
      }
    }
  })`,
  awaitPromise: true,
});
await popupClient.send('Page.reload', { ignoreCache: true });
await sleep(1600);

const opened = await popupClient.send('Runtime.evaluate', {
  expression: `(() => {
    const button = document.querySelector('button[aria-label="Select tags"]');
    if (!button) return false;
    button.click();
    return true;
  })()`,
  returnByValue: true,
});

if (!opened.result.value) {
  throw new Error('The tag selector was not available after loading the demo.');
}

await sleep(900);
await popupClient.send('Runtime.evaluate', {
  expression: `(() => {
    const choices = ['Accessibility', 'Product research'];
    const items = [...document.querySelectorAll('[role="option"]')];
    for (const choice of choices) {
      const item = items.find((candidate) => candidate.textContent.trim() === choice);
      if (item) item.click();
    }
    return [...document.querySelectorAll('[role="option"]')].map((item) => item.textContent.trim());
  })()`,
  returnByValue: true,
});
await sleep(350);
popupClient.close();

console.log('Tagwarden store demo is ready.');
