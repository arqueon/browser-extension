import { dedupeTags } from './tag-utils.ts';

export interface DomainTagRule {
  domain: string;
  tags: string[];
}

export interface TagUsageEntry {
  name: string;
  count: number;
  lastUsedAt: number;
  domains: Record<string, number>;
}

export const hostnameFor = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLocaleLowerCase();
  } catch (_error) {
    return '';
  }
};

export function rankTagSuggestions(
  usage: Record<string, TagUsageEntry>,
  rules: DomainTagRule[],
  url: string,
  limit = 8
) {
  const domain = hostnameFor(url);
  const ruleNames = rules
    .filter(
      (rule) => domain === rule.domain || domain.endsWith(`.${rule.domain}`)
    )
    .flatMap((rule) => rule.tags);
  const usageNames = Object.values(usage)
    .sort((left, right) => {
      const domainDifference =
        (right.domains[domain] ?? 0) - (left.domains[domain] ?? 0);
      if (domainDifference !== 0) return domainDifference;
      if (right.count !== left.count) return right.count - left.count;
      return right.lastUsedAt - left.lastUsedAt;
    })
    .map((entry) => entry.name);

  return dedupeTags(
    [...ruleNames, ...usageNames].map((name) => ({ name }))
  )
    .slice(0, limit)
    .map((tag) => tag.name);
}
