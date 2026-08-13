import { describe, expect, it } from 'vitest';
import {
  DomainTagRule,
  rankTagSuggestions,
  TagUsageEntry,
} from '../src/@/lib/tag-ranking.ts';

const usage: Record<string, TagUsageEntry> = {
  research: {
    name: 'research',
    count: 20,
    lastUsedAt: 100,
    domains: { 'arxiv.org': 6 },
  },
  reading: {
    name: 'read later',
    count: 40,
    lastUsedAt: 300,
    domains: {},
  },
  physics: {
    name: 'physics',
    count: 3,
    lastUsedAt: 200,
    domains: { 'arxiv.org': 3 },
  },
};

const rules: DomainTagRule[] = [
  { domain: 'arxiv.org', tags: ['paper', 'research'] },
];

describe('tag suggestions', () => {
  it('puts explicit domain rules before learned usage', () => {
    expect(
      rankTagSuggestions(usage, rules, 'https://arxiv.org/abs/1234')
    ).toEqual(['paper', 'research', 'physics', 'read later']);
  });

  it('applies parent-domain rules to subdomains', () => {
    expect(
      rankTagSuggestions(usage, rules, 'https://export.arxiv.org/api/query', 2)
    ).toEqual(['paper', 'research']);
  });

  it('deduplicates rule and history names without changing rule priority', () => {
    const repeatedRule = [
      { domain: 'arxiv.org', tags: ['Research', 'research', 'paper'] },
    ];

    expect(
      rankTagSuggestions(usage, repeatedRule, 'https://arxiv.org', 8)
    ).toEqual(['Research', 'paper', 'physics', 'read later']);
  });
});
