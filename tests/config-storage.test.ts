import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stored: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(stored)) delete stored[key];
  vi.stubGlobal('chrome', {
    runtime: { id: 'tagwarden-test' },
    storage: {
      local: {
        get: vi.fn(async (keys: string[]) =>
          Object.fromEntries(
            keys.flatMap((key) =>
              stored[key] === undefined ? [] : [[key, stored[key]]]
            )
          )
        ),
        set: vi.fn(async (values: Record<string, string>) => {
          Object.assign(stored, values);
        }),
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('connection storage', () => {
  it('persists and restores a verified connection', async () => {
    const { getConfig, isConfigured, saveConfig } = await import(
      '../src/@/lib/config.ts'
    );
    await saveConfig({
      baseUrl: 'https://links.example.org',
      apiKey: 'access.token',
      allowInsecureHttp: false,
      defaultCollection: 'Unorganized',
      connectionVerified: true,
      syncBookmarks: false,
    });

    await expect(getConfig()).resolves.toMatchObject({
      baseUrl: 'https://links.example.org',
      apiKey: 'access.token',
      allowInsecureHttp: false,
      connectionVerified: true,
    });
    await expect(isConfigured()).resolves.toBe(true);
  });

  it('keeps a failed token locally without enabling the other views', async () => {
    const { getConfig, isConfigured, saveConfig } = await import(
      '../src/@/lib/config.ts'
    );
    await saveConfig({
      baseUrl: 'https://links.example.org',
      apiKey: 'rejected.token',
      defaultCollection: 'Unorganized',
      connectionVerified: false,
      syncBookmarks: false,
    });

    await expect(getConfig()).resolves.toMatchObject({
      apiKey: 'rejected.token',
      connectionVerified: false,
    });
    await expect(isConfigured()).resolves.toBe(false);
  });

  it('restores explicit consent for a private HTTP instance', async () => {
    const { getConfig, isConfigured, saveConfig } = await import(
      '../src/@/lib/config.ts'
    );
    await saveConfig({
      baseUrl: 'http://192.168.1.20:3000',
      apiKey: 'local.token',
      allowInsecureHttp: true,
      defaultCollection: 'Unorganized',
      connectionVerified: true,
      syncBookmarks: false,
    });

    await expect(getConfig()).resolves.toMatchObject({
      allowInsecureHttp: true,
      connectionVerified: true,
    });
    await expect(isConfigured()).resolves.toBe(true);
  });

  it('does not trust private HTTP without stored consent', async () => {
    const { isConfigured, saveConfig } = await import(
      '../src/@/lib/config.ts'
    );
    await saveConfig({
      baseUrl: 'http://192.168.1.20:3000',
      apiKey: 'local.token',
      allowInsecureHttp: false,
      defaultCollection: 'Unorganized',
      connectionVerified: true,
      syncBookmarks: false,
    });

    await expect(isConfigured()).resolves.toBe(false);
  });
});
