import { getBrowser } from './utils.ts';
import { dedupeTags, normalizeTagName, TagOption } from './tag-utils.ts';
import {
  DomainTagRule,
  hostnameFor,
  rankTagSuggestions,
  TagUsageEntry,
} from './tag-ranking.ts';

export type { DomainTagRule, TagUsageEntry } from './tag-ranking.ts';
export { rankTagSuggestions } from './tag-ranking.ts';

const USAGE_KEY = 'tagwarden_tag_usage';
const RULES_KEY = 'tagwarden_domain_rules';

async function readStorage<T>(key: string, fallback: T): Promise<T> {
  const result = await getBrowser().storage.local.get([key]);
  return (result[key] as T | undefined) ?? fallback;
}

export async function getDomainRules(): Promise<DomainTagRule[]> {
  return await readStorage<DomainTagRule[]>(RULES_KEY, []);
}

export async function saveDomainRules(rules: DomainTagRule[]) {
  await getBrowser().storage.local.set({ [RULES_KEY]: rules });
}

export async function recordTagUsage(tags: TagOption[], url: string) {
  const current = await readStorage<Record<string, TagUsageEntry>>(
    USAGE_KEY,
    {}
  );
  const domain = hostnameFor(url);

  for (const tag of dedupeTags(tags)) {
    const name = normalizeTagName(tag.name);
    if (!name) continue;
    const identity = name.toLocaleLowerCase();
    const previous = current[identity];
    current[identity] = {
      name,
      count: (previous?.count ?? 0) + 1,
      lastUsedAt: Date.now(),
      domains: {
        ...(previous?.domains ?? {}),
        ...(domain
          ? { [domain]: (previous?.domains?.[domain] ?? 0) + 1 }
          : {}),
      },
    };
  }

  await getBrowser().storage.local.set({ [USAGE_KEY]: current });
}

export async function getTagSuggestions(url: string) {
  const [usage, rules] = await Promise.all([
    readStorage<Record<string, TagUsageEntry>>(USAGE_KEY, {}),
    getDomainRules(),
  ]);

  return rankTagSuggestions(usage, rules, url);
}
