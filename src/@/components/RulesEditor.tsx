import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DomainTagRule,
  getDomainRules,
  saveDomainRules,
} from '../lib/tag-preferences.ts';
import { dedupeTags, normalizeTagName } from '../lib/tag-utils.ts';
import { Button } from './ui/Button.tsx';
import { Input } from './ui/Input.tsx';

export function RulesEditor() {
  const [rules, setRules] = useState<DomainTagRule[]>([]);
  const [domain, setDomain] = useState('');
  const [tagNames, setTagNames] = useState('');

  useEffect(() => {
    void getDomainRules().then(setRules);
  }, []);

  const persist = async (nextRules: DomainTagRule[]) => {
    setRules(nextRules);
    await saveDomainRules(nextRules);
  };

  const addRule = async () => {
    const normalizedDomain = domain
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLocaleLowerCase();
    const tags = dedupeTags(
      tagNames.split(',').map((name) => ({ name: normalizeTagName(name) }))
    )
      .map((tag) => tag.name)
      .filter(Boolean);

    if (!normalizedDomain || tags.length === 0) return;

    const nextRule = { domain: normalizedDomain, tags };
    await persist([
      ...rules.filter((rule) => rule.domain !== normalizedDomain),
      nextRule,
    ].sort((left, right) => left.domain.localeCompare(right.domain)));
    setDomain('');
    setTagNames('');
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Domain suggestions</h3>
        <p className="text-xs text-muted-foreground">
          Suggest tags locally when a page belongs to a matching domain.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="arxiv.org"
          aria-label="Domain"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void addRule()}
          aria-label="Add domain rule"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Input
          className="col-span-2"
          value={tagNames}
          onChange={(event) => setTagNames(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void addRule();
            }
          }}
          placeholder="research, article, read later"
          aria-label="Suggested tags separated by commas"
        />
      </div>

      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.domain}
            className="flex items-start justify-between gap-2 rounded-md border p-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{rule.domain}</p>
              <p className="truncate text-xs text-muted-foreground">
                {rule.tags.join(', ')}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() =>
                void persist(rules.filter((candidate) => candidate !== rule))
              }
              aria-label={`Delete rule for ${rule.domain}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {rules.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No domain rules yet. Usage history will still provide suggestions.
          </p>
        ) : null}
      </div>
    </section>
  );
}
