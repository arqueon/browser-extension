import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readManifest = (target: 'chrome' | 'firefox') =>
  JSON.parse(
    readFileSync(new URL(`../manifest.${target}.json`, import.meta.url), 'utf8')
  );

const packageVersion = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version;

describe('browser packages', () => {
  it('keeps package and browser versions aligned', () => {
    expect(readManifest('chrome').version).toBe(packageVersion);
    expect(readManifest('firefox').version).toBe(packageVersion);
  });

  it('uses a service worker only in Chrome', () => {
    const manifest = readManifest('chrome');

    expect(manifest.background).toEqual({
      service_worker: 'background.js',
      type: 'module',
    });
    expect(manifest.background).not.toHaveProperty('scripts');
  });

  it('uses background scripts and a distinct add-on id only in Firefox', () => {
    const manifest = readManifest('firefox');

    expect(manifest.background.scripts).toEqual(['background.js']);
    expect(manifest.background).not.toHaveProperty('service_worker');
    expect(manifest.browser_specific_settings.gecko.id).toBe(
      'tagwarden@arqueon.dev'
    );
    expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe(
      '140.0'
    );
    expect(
      manifest.browser_specific_settings.gecko.data_collection_permissions
        .required
    ).toEqual([
      'authenticationInfo',
      'browsingActivity',
      'websiteContent',
    ]);
    expect(
      manifest.browser_specific_settings.gecko_android.strict_min_version
    ).toBe('142.0');
  });

  it.each(['chrome', 'firefox'] as const)(
    'keeps host access optional in %s',
    (target) => {
      const manifest = readManifest(target);

      expect(manifest.name).toBe('Tagwarden — Tags for Linkwarden');
      expect(manifest.host_permissions).toBeUndefined();
      expect(manifest.optional_host_permissions).toEqual(['<all_urls>']);
      expect(manifest.permissions).not.toContain('bookmarks');
    }
  );
});
