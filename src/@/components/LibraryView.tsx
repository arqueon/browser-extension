import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import { getAllTags } from '../lib/actions/tags.ts';
import { searchLibrary } from '../lib/actions/links.ts';
import { getConfig } from '../lib/config.ts';
import { ExistingLink } from '../lib/link-utils.ts';
import { TagOption } from '../lib/tag-utils.ts';
import { getBrowser } from '../lib/utils.ts';
import { Button } from './ui/Button.tsx';
import { Input } from './ui/Input.tsx';
import { TagInput } from './TagInput.tsx';

export function LibraryView() {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);
  const [results, setResults] = useState<ExistingLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string>();

  const configQuery = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const tagsQuery = useQuery({
    queryKey: ['all-tags', configQuery.data?.baseUrl],
    queryFn: () =>
      getAllTags(configQuery.data!.baseUrl, configQuery.data!.apiKey),
    enabled: Boolean(configQuery.data?.baseUrl && configQuery.data?.apiKey),
  });

  const runSearch = async () => {
    if (!configQuery.data) return;
    setBusy(true);
    setError(undefined);
    try {
      const links = await searchLibrary(
        configQuery.data.baseUrl,
        configQuery.data.apiKey,
        {
          query,
          tagIds: selectedTags.flatMap((tag) =>
            tag.id === undefined ? [] : [tag.id]
          ),
        }
      );
      setResults(links);
      setSearched(true);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Library search failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3">
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <div>
          <h2 className="text-sm font-semibold">Find by tags</h2>
          <p className="text-xs text-muted-foreground">
            Selecting several tags uses AND: every result has all of them.
          </p>
        </div>
        <TagInput
          value={selectedTags}
          onChange={setSelectedTags}
          tags={tagsQuery.data}
          isLoading={tagsQuery.isLoading}
          allowCreate={false}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void runSearch();
              }}
              placeholder="Optional title, URL or note"
            />
          </div>
          <Button
            type="button"
            className="tagwarden-primary"
            disabled={busy || (!query.trim() && selectedTags.length === 0)}
            onClick={() => void runSearch()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive p-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {results.map((link) => (
          <button
            type="button"
            key={link.id}
            className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
            onClick={() => void getBrowser().tabs.create({ url: link.url })}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {link.name || link.url}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {link.url}
                </p>
                {link.tags?.length ? (
                  <p className="mt-1 truncate text-xs text-tag-accent">
                    {link.tags.map((tag) => tag.name).join(' · ')}
                  </p>
                ) : null}
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </button>
        ))}
        {searched && results.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No links match this combination.
          </p>
        ) : null}
      </div>
    </div>
  );
}
