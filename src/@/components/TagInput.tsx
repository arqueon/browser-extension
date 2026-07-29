import {
  FC,
  KeyboardEvent,
  UIEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from './ui/Button.tsx';
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/Command.tsx';
import { cn } from '../lib/utils.ts';
import { ResponseTags } from '../lib/actions/tags.ts';
import {
  addPendingTagSelection,
  filterAndSortTags,
  findExactTag,
  getCreatableTagName,
  isSameTagName,
  normalizeTagName,
  removeTagSelection,
  TagOption,
  toggleTagSelection,
} from '../lib/tag-utils.ts';

interface TagInputProps {
  onChange: (tags: TagOption[]) => void;
  value: TagOption[];
  tags: Pick<ResponseTags, 'id' | 'name'>[] | undefined;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
  isSearching?: boolean;
  errorMessage?: string;
  onReachEnd?: () => void;
  onSearchChange?: (value: string) => void;
}

export const TagInput: FC<TagInputProps> = ({
  value,
  onChange,
  tags,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isSearching,
  errorMessage,
  onReachEnd,
  onSearchChange,
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);
  const listScrollTopRef = useRef(0);

  const availableTags = useMemo(
    () => (Array.isArray(tags) ? tags : []),
    [tags]
  );
  const filteredTags = useMemo(
    () => filterAndSortTags(availableTags, inputValue),
    [availableTags, inputValue]
  );
  const exactTag = useMemo(
    () => findExactTag(availableTags, inputValue),
    [availableTags, inputValue]
  );
  const creatableTagName = useMemo(() => {
    if (isLoading || isSearching || errorMessage) return null;
    return getCreatableTagName(inputValue, availableTags, value);
  }, [
    availableTags,
    errorMessage,
    inputValue,
    isLoading,
    isSearching,
    value,
  ]);

  const updateSearch = (search: string) => {
    setInputValue(search);
    onSearchChange?.(search);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) updateSearch('');
  };

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || isFetchingNextPage || !onReachEnd) return;

    const target = event.currentTarget;
    listScrollTopRef.current = target.scrollTop;
    const reachedBottom =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 16;

    if (reachedBottom) onReachEnd();
  };

  const handleCreateTag = () => {
    const nextValue = addPendingTagSelection(
      value,
      availableTags,
      inputValue
    );

    if (nextValue === value) return;

    onChange(nextValue);
    updateSearch('');
  };

  const handleSelectTag = (tag: TagOption) => {
    onChange(toggleTagSelection(value, tag));

    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listScrollTopRef.current;
      }
    });
  };

  const handleRemoveTag = (tagName: string) => {
    onChange(removeTagSelection(value, tagName));
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      handleOpenChange(false);
      return;
    }

    if (event.key !== ',') return;

    event.preventDefault();

    if (exactTag) {
      const isAlreadySelected = value.some((tag) =>
        isSameTagName(tag.name, exactTag.name)
      );

      if (!isAlreadySelected) onChange([...value, exactTag]);
      updateSearch('');
      return;
    }

    handleCreateTag();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    handleOpenChange(false);
  };

  const normalizedInputValue = normalizeTagName(inputValue);
  const showNoResults =
    !isLoading &&
    !isSearching &&
    !errorMessage &&
    filteredTags.length === 0 &&
    !creatableTagName;
  const selectedTagsLabel = value.map((tag) => tag.name).join(', ');

  return (
    <div className={cn('min-w-full space-y-2', open && 'h-[600px]')}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-haspopup="dialog"
        aria-label={
          selectedTagsLabel
            ? `Selected tags: ${selectedTagsLabel}`
            : 'Select tags'
        }
        aria-expanded={open}
        title={selectedTagsLabel || undefined}
        className="w-full justify-between bg-neutral-100 dark:bg-neutral-900"
        onClick={() => handleOpenChange(true)}
      >
        <span className="truncate">
          {selectedTagsLabel || 'Select tags...'}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select tags"
          className="fixed inset-0 z-50 flex h-full w-full flex-col bg-background text-foreground"
          onKeyDown={handleDialogKeyDown}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <div className="min-w-0 flex-1 pr-3">
              <h2 className="text-base font-semibold">Tags</h2>
              <p
                className="truncate text-xs text-muted-foreground"
                aria-live="polite"
                title={selectedTagsLabel || undefined}
              >
                {value.length > 0
                  ? `${value.length} selected: ${selectedTagsLabel}`
                  : 'No tags selected'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          </div>

          <Command
            className="min-h-0 flex-1 rounded-none"
            shouldFilter={false}
          >
            <CommandInput
              autoFocus
              className="min-w-[280px]"
              placeholder="Search or create a tag..."
              value={inputValue}
              onValueChange={updateSearch}
              onKeyDown={handleSearchKeyDown}
            />

            <CommandList
              ref={listRef}
              className="min-h-0 max-h-none flex-1"
              onScroll={handleListScroll}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tags...
                </div>
              ) : errorMessage ? (
                <p className="px-3 py-6 text-center text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : (
                <>
                  {creatableTagName ? (
                    <CommandGroup heading="Create">
                      <CommandItem
                        className="w-full cursor-pointer"
                        value={`create ${creatableTagName}`}
                        onSelect={handleCreateTag}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="truncate">
                          Create tag “{creatableTagName}”
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  ) : null}

                  {filteredTags.length > 0 ? (
                    <CommandGroup heading="Matching tags">
                      {filteredTags.map((tag) => {
                        const isSelected = value.some((selectedTag) =>
                          isSameTagName(selectedTag.name, tag.name)
                        );

                        return (
                          <CommandItem
                            className="w-full cursor-pointer"
                            key={tag.id ?? tag.name}
                            value={tag.name}
                            onSelect={() => handleSelectTag(tag)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                isSelected ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="truncate">{tag.name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : null}

                  {isSearching ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching all tags...
                    </div>
                  ) : null}

                  {showNoResults ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {normalizedInputValue
                        ? 'No matching tag found.'
                        : 'No tags available.'}
                    </p>
                  ) : null}

                  {isFetchingNextPage ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading more tags...
                    </div>
                  ) : null}
                </>
              )}
            </CommandList>
          </Command>
        </div>
      ) : null}

      {value.length > 0 ? (
        <div
          className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto"
          aria-label="Selected tags"
        >
          {value.map((tag) => (
            <span
              key={tag.id ?? tag.name}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground"
            >
              <span className="truncate">{tag.name}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove tag ${tag.name}`}
                onClick={() => handleRemoveTag(tag.name)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
