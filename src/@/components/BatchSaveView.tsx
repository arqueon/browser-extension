import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getCollections } from '../lib/actions/collections.ts';
import { getLinkByUrl, postLink } from '../lib/actions/links.ts';
import { getAllTags } from '../lib/actions/tags.ts';
import { getConfig } from '../lib/config.ts';
import { TagOption } from '../lib/tag-utils.ts';
import { recordTagUsage } from '../lib/tag-preferences.ts';
import { getBrowser } from '../lib/utils.ts';
import { bookmarkFormValues } from '../lib/validators/bookmarkForm.ts';
import { Button } from './ui/Button.tsx';
import { Checkbox } from './ui/CheckBox.tsx';
import { TagInput } from './TagInput.tsx';

interface BatchTab {
  id?: number;
  title?: string;
  url?: string;
}

export function BatchSaveView() {
  const [tabs, setTabs] = useState<BatchTab[]>([]);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);
  const [collectionId, setCollectionId] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string>();

  const configQuery = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const tagsQuery = useQuery({
    queryKey: ['all-tags', configQuery.data?.baseUrl],
    queryFn: () =>
      getAllTags(configQuery.data!.baseUrl, configQuery.data!.apiKey),
    enabled: Boolean(configQuery.data?.baseUrl && configQuery.data?.apiKey),
  });
  const collectionsQuery = useQuery({
    queryKey: ['collections', configQuery.data?.baseUrl],
    queryFn: async () =>
      (await getCollections(configQuery.data!.baseUrl, configQuery.data!.apiKey))
        .data.response,
    enabled: Boolean(configQuery.data?.baseUrl && configQuery.data?.apiKey),
  });

  useEffect(() => {
    void Promise.resolve(getBrowser().tabs.query({ currentWindow: true })).then(
      (browserTabs) => {
        const normalizedTabs = browserTabs as BatchTab[];
        const eligible = normalizedTabs.filter(
          (tab) => tab.id !== undefined && /^https?:\/\//.test(tab.url ?? '')
        );
        setTabs(eligible);
        setSelectedTabIds(
          new Set(eligible.flatMap((tab) => (tab.id === undefined ? [] : [tab.id])))
        );
      }
    );
  }, []);

  useEffect(() => {
    if (configQuery.data?.defaultCollectionId)
      setCollectionId(configQuery.data.defaultCollectionId);
  }, [configQuery.data]);

  const selectedTabs = useMemo(
    () => tabs.filter((tab) => tab.id !== undefined && selectedTabIds.has(tab.id)),
    [selectedTabIds, tabs]
  );

  const saveBatch = async () => {
    if (!configQuery.data || selectedTabs.length === 0) return;
    setBusy(true);
    setSummary(undefined);
    let saved = 0;
    let skipped = 0;
    let failed = 0;
    const collection = collectionsQuery.data?.find(
      (candidate) => candidate.id === collectionId
    );

    for (const tab of selectedTabs) {
      if (!tab.url) continue;
      try {
        const existing = await getLinkByUrl(
          configQuery.data.baseUrl,
          configQuery.data.apiKey,
          tab.url
        );
        if (existing) {
          skipped += 1;
          continue;
        }
        const values: bookmarkFormValues = {
          url: tab.url,
          name: tab.title ?? tab.url,
          description: '',
          collection: collection
            ? {
                id: collection.id,
                ownerId: collection.ownerId,
                name: collection.name,
              }
            : { name: 'Unorganized' },
          tags: selectedTags,
        };
        await postLink(
          configQuery.data.baseUrl,
          false,
          values,
          () => undefined,
          configQuery.data.apiKey
        );
        await recordTagUsage(selectedTags, tab.url);
        saved += 1;
      } catch (_error) {
        failed += 1;
      }
    }

    setSummary(`${saved} saved · ${skipped} already present · ${failed} failed`);
    setBusy(false);
  };

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3">
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 className="text-sm font-semibold">Save open tabs</h2>
          <p className="text-xs text-muted-foreground">
            Apply one collection and tag set. Existing links are skipped.
          </p>
        </div>
        <TagInput
          value={selectedTags}
          onChange={setSelectedTags}
          tags={tagsQuery.data}
          isLoading={tagsQuery.isLoading}
        />
        <select
          className="tagwarden-select"
          value={collectionId ?? ''}
          onChange={(event) =>
            setCollectionId(
              event.target.value ? Number(event.target.value) : undefined
            )
          }
        >
          <option value="">Unorganized</option>
          {collectionsQuery.data?.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.pathname}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selectedTabs.length} of {tabs.length} tabs selected
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() =>
            setSelectedTabIds(
              selectedTabIds.size === tabs.length
                ? new Set()
                : new Set(
                    tabs.flatMap((tab) =>
                      tab.id === undefined ? [] : [tab.id]
                    )
                  )
            )
          }
        >
          {selectedTabIds.size === tabs.length ? 'Clear all' : 'Select all'}
        </Button>
      </div>

      <div className="space-y-1">
        {tabs.map((tab) => (
          <label
            key={tab.id}
            className="flex cursor-pointer items-start gap-2 rounded-md border bg-card p-2"
          >
            <Checkbox
              className="mt-0.5"
              checked={tab.id !== undefined && selectedTabIds.has(tab.id)}
              onCheckedChange={(checked) => {
                if (tab.id === undefined) return;
                const next = new Set(selectedTabIds);
                if (checked === true) next.add(tab.id);
                else next.delete(tab.id);
                setSelectedTabIds(next);
              }}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm">
                {tab.title || tab.url}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {tab.url}
              </span>
            </span>
          </label>
        ))}
      </div>

      {summary ? (
        <p className="rounded-md border p-2 text-xs" aria-live="polite">
          <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />
          {summary}
        </p>
      ) : null}

      <Button
        type="button"
        className="tagwarden-primary sticky bottom-0 w-full"
        disabled={busy || selectedTabs.length === 0}
        onClick={() => void saveBatch()}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save selected tabs
      </Button>
    </div>
  );
}
