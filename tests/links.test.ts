import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findExactLinkByUrl } from '../src/@/lib/link-utils.ts';
import type { ExistingLink } from '../src/@/lib/link-utils.ts';

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
    assert.deepEqual(
      findExactLinkByUrl(links, 'https://example.com/article'),
      links[0]
    );
  });

  it('does not treat a partial URL match as an existing link', () => {
    assert.equal(findExactLinkByUrl(links, 'https://example.com'), null);
  });

  it('matches the URL variants Linkwarden treats as duplicates', () => {
    assert.deepEqual(
      findExactLinkByUrl(links, 'https://www.example.com/article/'),
      links[0]
    );
  });
});
