import { describe, expect, it } from 'vitest';
import {
  ExistingLink,
  findExactLinkByUrl,
} from '../src/@/lib/link-utils.ts';

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
