import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  GitMerge,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  createTag,
  deleteTags,
  getAllTags,
  mergeTags,
  renameTag,
  ResponseTags,
} from '../lib/actions/tags.ts';
import { getConfig } from '../lib/config.ts';
import {
  filterAndSortTags,
  findExactTag,
  normalizeTagName,
} from '../lib/tag-utils.ts';
import { Button } from './ui/Button.tsx';
import { Checkbox } from './ui/CheckBox.tsx';
import { Input } from './ui/Input.tsx';

type PendingAction = 'delete' | 'merge' | null;

export function TagManagerView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number>();
  const [editingName, setEditingName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeName, setMergeName] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  });
  const tagsQuery = useQuery({
    queryKey: ['all-tags', configQuery.data?.baseUrl],
    queryFn: () =>
      getAllTags(configQuery.data!.baseUrl, configQuery.data!.apiKey),
    enabled: Boolean(configQuery.data?.baseUrl && configQuery.data?.apiKey),
  });
  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
  const visibleTags = useMemo(
    () => filterAndSortTags(tags, search),
    [search, tags]
  );
  const selectedTags = tags.filter((tag) => selectedIds.has(tag.id));
  const affectedLinks = selectedTags.reduce(
    (total, tag) => total + (tag._count?.links ?? 0),
    0
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['all-tags'] });
    await queryClient.invalidateQueries({ queryKey: ['tags'] });
  };

  const perform = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await operation();
      await refresh();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The action failed.');
    } finally {
      setBusy(false);
    }
  };

  const addTag = async () => {
    const name = normalizeTagName(newName);
    if (!name || !configQuery.data) return;
    if (findExactTag(tags, name)) {
      setMessage('That tag already exists.');
      return;
    }
    await perform(
      () => createTag(configQuery.data!.baseUrl, configQuery.data!.apiKey, name),
      `Created “${name}”.`
    );
    setNewName('');
  };

  const saveRename = async (tag: ResponseTags) => {
    const name = normalizeTagName(editingName);
    if (!name || !configQuery.data) return;
    const duplicate = findExactTag(tags, name);
    if (duplicate && duplicate.id !== tag.id) {
      setMessage('That name already belongs to another tag. Use Merge instead.');
      return;
    }
    await perform(
      () =>
        renameTag(
          configQuery.data!.baseUrl,
          configQuery.data!.apiKey,
          tag.id,
          name
        ),
      `Renamed “${tag.name}” to “${name}”.`
    );
    setEditingId(undefined);
  };

  const confirmDelete = async () => {
    if (!configQuery.data || selectedIds.size === 0) return;
    await perform(
      () =>
        deleteTags(
          configQuery.data!.baseUrl,
          configQuery.data!.apiKey,
          [...selectedIds]
        ),
      `Deleted ${selectedIds.size} tag${selectedIds.size === 1 ? '' : 's'}.`
    );
    setSelectedIds(new Set());
    setPendingAction(null);
  };

  const confirmMerge = async () => {
    const name = normalizeTagName(mergeName);
    if (!configQuery.data || selectedIds.size === 0 || !name) return;
    await perform(
      () =>
        mergeTags(
          configQuery.data!.baseUrl,
          configQuery.data!.apiKey,
          [...selectedIds],
          name
        ),
      `Merged ${selectedIds.size} tags into “${name}”.`
    );
    setSelectedIds(new Set());
    setMergeName('');
    setPendingAction(null);
  };

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3">
      <div className="rounded-lg border bg-card p-3">
        <h2 className="text-sm font-semibold">Create tag</h2>
        <div className="mt-2 flex gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addTag();
              }
            }}
            placeholder="New tag name"
          />
          <Button
            type="button"
            className="tagwarden-primary"
            size="icon"
            disabled={busy || !newName.trim()}
            onClick={() => void addTag()}
            aria-label="Create tag"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search all tags"
        />
      </div>

      {selectedIds.size > 0 ? (
        <div className="rounded-lg border border-tag-accent/30 bg-secondary p-3">
          <p className="text-sm font-medium">
            {selectedIds.size} selected · up to {affectedLinks} linked items
          </p>
          {pendingAction === null ? (
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setPendingAction('merge')}
              >
                <GitMerge className="mr-2 h-4 w-4" /> Merge
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => setPendingAction('delete')}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          ) : pendingAction === 'merge' ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Links keep working; selected tags become one target tag.
              </p>
              <Input
                value={mergeName}
                onChange={(event) => setMergeName(event.target.value)}
                placeholder="Target tag name"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPendingAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="tagwarden-primary flex-1"
                  disabled={busy || !mergeName.trim()}
                  onClick={() => void confirmMerge()}
                >
                  Confirm merge
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-destructive">
                Remove these tags from up to {affectedLinks} linked items? This
                cannot be undone from Tagwarden.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPendingAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void confirmDelete()}
                >
                  Confirm delete
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {message ? (
        <p className="rounded-md border p-2 text-xs" aria-live="polite">
          {message}
        </p>
      ) : null}

      {tagsQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tags…
        </div>
      ) : (
        <div className="space-y-1">
          {visibleTags.map((tag) => {
            const selected = selectedIds.has(tag.id);
            const editing = editingId === tag.id;
            return (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-md border bg-card p-2"
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedIds);
                    if (checked === true) next.add(tag.id);
                    else next.delete(tag.id);
                    setSelectedIds(next);
                    setPendingAction(null);
                  }}
                  aria-label={`Select ${tag.name}`}
                />
                {editing ? (
                  <Input
                    className="h-8 flex-1"
                    autoFocus
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void saveRename(tag);
                      if (event.key === 'Escape') setEditingId(undefined);
                    }}
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tag.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tag._count?.links ?? 0} links
                    </p>
                  </div>
                )}
                {editing ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busy}
                      onClick={() => void saveRename(tag)}
                      aria-label={`Save ${tag.name}`}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingId(undefined)}
                      aria-label="Cancel rename"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingId(tag.id);
                      setEditingName(tag.name);
                    }}
                    aria-label={`Rename ${tag.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
          {visibleTags.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tags match this search.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
