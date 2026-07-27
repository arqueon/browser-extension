import { FC, KeyboardEvent, UIEvent, useMemo, useState } from 'react';
import { Button } from './ui/Button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover.tsx';
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
    const reachedBottom =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 16;

    if (reachedBottom) onReachEnd();
  };

  const handleCreateTag = () => {
    if (!creatableTagName) return;

    onChange([...value, { name: creatableTagName }]);
    updateSearch('');
  };

  const handleSelectTag = (tag: TagOption) => {
    onChange(toggleTagSelection(value, tag));
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

  const normalizedInputValue = normalizeTagName(inputValue);
  const showNoResults =
    !isLoading &&
    !isSearching &&
    !errorMessage &&
    filteredTags.length === 0 &&
    !creatableTagName;

  return (
    <div className="min-w-full space-y-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Select tags"
            aria-expanded={open}
            className="w-full justify-between bg-neutral-100 dark:bg-neutral-900"
          >
            <span className="truncate">
              {value.length > 0
                ? `${value.length} tag${value.length === 1 ? '' : 's'} selected`
                : 'Select tags...'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command className="min-w-full" shouldFilter={false}>
            <CommandInput
              autoFocus
              className="min-w-[280px]"
              placeholder="Search or create a tag..."
              value={inputValue}
              onValueChange={updateSearch}
              onKeyDown={handleSearchKeyDown}
            />

            <CommandList
              className="max-h-[240px]"
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
        </PopoverContent>
      </Popover>

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
