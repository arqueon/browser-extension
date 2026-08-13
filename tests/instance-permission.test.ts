import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({ default: {} }));

afterEach(() => vi.unstubAllGlobals());

describe('instance host permission', () => {
  it('requests a Firefox-compatible origin without a port', async () => {
    const request = vi.fn(async () => true);
    vi.stubGlobal('browser', {
      runtime: { getURL: () => 'moz-extension://tagwarden/' },
      permissions: { request },
    });

    const { requestInstancePermission } = await import('../src/@/lib/utils.ts');
    await expect(
      requestInstancePermission('https://192.168.1.20:3443')
    ).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({
      origins: ['https://192.168.1.20/*'],
    });
  });

  it('keeps the exact port in Chromium', async () => {
    const request = vi.fn(async () => true);
    vi.stubGlobal('browser', {
      runtime: { getURL: () => 'chrome-extension://tagwarden/' },
      permissions: { request },
    });

    const { requestInstancePermission } = await import('../src/@/lib/utils.ts');
    await expect(
      requestInstancePermission('https://192.168.1.20:3443')
    ).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({
      origins: ['https://192.168.1.20:3443/*'],
    });
  });
});
