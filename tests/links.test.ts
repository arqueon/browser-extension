import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUpdateLinkPayload,
  getLinkById,
  getLinkByUrl,
} from '../src/@/lib/actions/links.ts';
import {
  ExistingLink,
  findExactLinkByUrl,
} from '../src/@/lib/link-utils.ts';

vi.mock('webextension-polyfill', () => ({ default: {} }));

const links: ExistingLink[] = [
  {
    id: 1,
    url: 'https://example.com/article',
    name: 'Article',
  },
  {
    id: 2,
    url: 'https://example.com/article/related',
    name: 'Related article',
  },
];

describe('existing link lookup', () => {
  it('returns only the link whose URL exactly matches the active tab', () => {
    expect(
      findExactLinkByUrl(links, 'https://example.com/article')
    ).toEqual(links[0]);
  });

  it('does not treat a partial URL match as an existing link', () => {
    expect(findExactLinkByUrl(links, 'https://example.com')).toBe(null);
  });

  it('matches the URL variants Linkwarden treats as duplicates', () => {
    expect(
      findExactLinkByUrl(links, 'https://www.example.com/article/')
    ).toEqual(links[0]);
  });
});

describe('Linkwarden update contract', () => {
  it('includes the complete collection relation and a tag array', () => {
    expect(
      buildUpdateLinkPayload(42, {
        url: 'https://example.com/article',
        name: 'Article',
        description: 'Worth keeping',
        collection: {
          id: 7,
          ownerId: 3,
          name: 'Unorganized',
        },
      })
    ).toEqual({
      id: 42,
      url: 'https://example.com/article',
      name: 'Article',
      description: 'Worth keeping',
      collection: { id: 7, ownerId: 3 },
      tags: [],
    });
  });

  it('refuses to send an Unorganized placeholder without numeric ids', () => {
    expect(() =>
      buildUpdateLinkPayload(42, {
        url: 'https://example.com/article',
        name: 'Article',
        description: 'Worth keeping',
        collection: { name: 'Unorganized' },
        tags: [],
      })
    ).toThrow('The link collection could not be loaded');
  });
});

describe('existing link hydration', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
        },
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads the full link after finding a search summary', async () => {
    const summary = {
      id: 42,
      url: 'https://example.com/article',
      name: 'Article',
    };
    const fullLink = {
      ...summary,
      description: 'Original note',
      collection: { id: 7, ownerId: 3, name: 'Unorganized' },
      tags: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { links: [summary] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: fullLink }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getLinkByUrl(
        'https://links.example.org',
        'access.token',
        summary.url
      )
    ).resolves.toEqual(fullLink);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://links.example.org/api/v1/links/42',
      { headers: { Authorization: 'Bearer access.token' } }
    );
  });

  it('rejects an incomplete full-link response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ response: null }),
      }))
    );

    await expect(
      getLinkById('https://links.example.org', 'access.token', 42)
    ).rejects.toThrow('Linkwarden returned incomplete link details');
  });
});
