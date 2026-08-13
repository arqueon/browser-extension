import { getBrowser } from '../../@/lib/utils.ts';

const browser = getBrowser();
const INITIAL_VIEW_KEY = 'tagwarden_initial_view';

async function openTagwarden(view: 'capture' | 'batch') {
  await browser.storage.local.set({ [INITIAL_VIEW_KEY]: view });

  if (browser.action?.openPopup) {
    try {
      await browser.action.openPopup();
      return;
    } catch (_error) {
      // Firefox versions without action.openPopup fall back to a regular tab.
    }
  }

  await browser.tabs.create({ url: browser.runtime.getURL('index.html') });
}

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.removeAll(() => {
    browser.contextMenus.create({
      id: 'tagwarden-save-page',
      title: 'Save or edit with Tagwarden',
      contexts: ['page', 'link', 'selection', 'image'],
    });
    browser.contextMenus.create({
      id: 'tagwarden-save-tabs',
      title: 'Save open tabs with Tagwarden',
      contexts: ['page'],
    });
  });
});

browser.contextMenus.onClicked.addListener(async (info) => {
  await openTagwarden(
    info.menuItemId === 'tagwarden-save-tabs' ? 'batch' : 'capture'
  );
});
