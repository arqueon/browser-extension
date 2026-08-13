import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Image, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from '../../hooks/use-toast.ts';
import { getCollections } from '../lib/actions/collections.ts';
import {
  getLinkByUrl,
  postLink,
  rememberSavedLink,
  updateLink,
} from '../lib/actions/links.ts';
import { getShouldUseTagSearch, getTags } from '../lib/actions/tags.ts';
import { getConfig } from '../lib/config.ts';
import { ExistingLink } from '../lib/link-utils.ts';
import { dedupeTags, TagOption } from '../lib/tag-utils.ts';
import {
  getTagSuggestions,
  recordTagUsage,
} from '../lib/tag-preferences.ts';
import { getCurrentTabInfo, setBadgeExists } from '../lib/utils.ts';
import {
  bookmarkFormSchema,
  bookmarkFormValues,
} from '../lib/validators/bookmarkForm.ts';
import { Button } from './ui/Button.tsx';
import { Checkbox } from './ui/CheckBox.tsx';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/Form.tsx';
import { Input } from './ui/Input.tsx';
import { Label } from './ui/Label.tsx';
import { TagInput } from './TagInput.tsx';
import { Textarea } from './ui/Textarea.tsx';
import { Toaster } from './ui/Toaster.tsx';

interface BookmarkFormProps {
  onManageTags: () => void;
}

const BookmarkForm = ({ onManageTags }: BookmarkFormProps) => {
  const [config, setConfig] = useState<Awaited<ReturnType<typeof getConfig>>>();
  const [tabInfo, setTabInfo] = useState<
    Awaited<ReturnType<typeof getCurrentTabInfo>>
  >();
  const [existingLink, setExistingLink] = useState<ExistingLink | null>(null);
  const [checkingLink, setCheckingLink] = useState(true);
  const [uploadImage, setUploadImage] = useState(false);
  const [captureState, setCaptureState] = useState<
    'capturing' | 'uploading' | null
  >(null);
  const [tagSearch, setTagSearch] = useState('');
  const [debouncedTagSearch, setDebouncedTagSearch] = useState('');

  const form = useForm<bookmarkFormValues>({
    resolver: zodResolver(bookmarkFormSchema),
    defaultValues: {
      url: '',
      name: '',
      collection: { name: 'Unorganized' },
      tags: [],
      description: '',
      image: undefined,
    },
  });

  useEffect(() => {
    void (async () => {
      try {
        const [nextTab, nextConfig] = await Promise.all([
          getCurrentTabInfo(),
          getConfig(),
        ]);
        setTabInfo(nextTab);
        setConfig(nextConfig);
        form.reset({
          url: nextTab.url ?? '',
          name: nextTab.title ?? '',
          collection: { name: nextConfig.defaultCollection },
          tags: [],
          description: '',
          image: undefined,
        });

        if (!nextTab.url) return;
        const found = await getLinkByUrl(
          nextConfig.baseUrl,
          nextConfig.apiKey,
          nextTab.url
        );
        setExistingLink(found);
        setBadgeExists(nextTab.id, Boolean(found));

        if (found) {
          form.reset({
            url: found.url,
            name: found.name || nextTab.title || '',
            collection: found.collection ?? {
              name: nextConfig.defaultCollection,
            },
            tags: found.tags ?? [],
            description: found.description ?? '',
            image: undefined,
          });
        }
      } catch (error) {
        console.error('Could not prepare the current page', error);
        toast({
          title: 'Could not load this page',
          description: 'Check the Linkwarden connection and try again.',
          variant: 'destructive',
        });
      } finally {
        setCheckingLink(false);
      }
    })();
  }, [form]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedTagSearch(tagSearch.trim()),
      200
    );
    return () => window.clearTimeout(timeoutId);
  }, [tagSearch]);

  const collectionsQuery = useQuery({
    queryKey: ['collections', config?.baseUrl],
    queryFn: async () =>
      (await getCollections(config!.baseUrl, config!.apiKey)).data.response,
    enabled: Boolean(config?.baseUrl && config?.apiKey),
  });

  useEffect(() => {
    if (existingLink || !config?.defaultCollectionId) return;
    const defaultCollection = collectionsQuery.data?.find(
      (collection) => collection.id === config.defaultCollectionId
    );
    if (!defaultCollection) return;
    form.setValue('collection', {
      id: defaultCollection.id,
      ownerId: defaultCollection.ownerId,
      name: defaultCollection.name,
    });
  }, [collectionsQuery.data, config, existingLink, form]);

  const tagSearchSupport = useQuery({
    queryKey: ['tag-search-support', config?.baseUrl],
    queryFn: () => getShouldUseTagSearch(config!.baseUrl, config!.apiKey),
    enabled: Boolean(config?.baseUrl && config?.apiKey),
  });
  const effectiveSearch = tagSearchSupport.data ? debouncedTagSearch : '';
  const tagsQuery = useInfiniteQuery(
    ['tags', config?.baseUrl, effectiveSearch],
    ({ pageParam = 0, signal }) =>
      getTags(
        config!.baseUrl,
        config!.apiKey,
        pageParam,
        effectiveSearch,
        signal
      ),
    {
      enabled: Boolean(config?.baseUrl && config?.apiKey),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }
  );
  const tags = useMemo(
    () =>
      dedupeTags(tagsQuery.data?.pages.flatMap((page) => page.tags) ?? []).sort(
        (left, right) =>
          left.name.localeCompare(right.name, undefined, {
            sensitivity: 'base',
          })
      ),
    [tagsQuery.data]
  );

  const suggestionsQuery = useQuery({
    queryKey: ['tag-suggestions', tabInfo?.url],
    queryFn: () => getTagSuggestions(tabInfo!.url!),
    enabled: Boolean(tabInfo?.url),
  });
  const suggestedTags = useMemo<TagOption[]>(
    () =>
      (suggestionsQuery.data ?? []).map(
        (name) =>
          tags.find(
            (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase()
          ) ?? { name }
      ),
    [suggestionsQuery.data, tags]
  );

  const saveMutation = useMutation({
    mutationFn: async (values: bookmarkFormValues) => {
      if (!config) throw new Error('Tagwarden is not configured.');
      if (existingLink) {
        return await updateLink(
          config.baseUrl,
          existingLink.id,
          values,
          config.apiKey
        );
      }
      return await postLink(
        config.baseUrl,
        uploadImage,
        values,
        setCaptureState,
        config.apiKey
      );
    },
    onSuccess: async (response, values) => {
      const saved = response?.data?.response as ExistingLink | undefined;
      if (saved && config) {
        await rememberSavedLink(config.baseUrl, saved);
        setExistingLink(saved);
      }
      if (values.url) await recordTagUsage(values.tags ?? [], values.url);
      setBadgeExists(tabInfo?.id, true);
      toast({
        title: existingLink ? 'Link updated' : 'Link saved',
        description: 'Tags and metadata are now in Linkwarden.',
      });
    },
    onError: (error) => {
      const description =
        error instanceof AxiosError
          ? error.response?.data?.response || error.message
          : 'Check the Linkwarden connection and try again.';
      toast({ title: 'Could not save', description, variant: 'destructive' });
    },
  });

  const selectedCollectionId = form.watch('collection')?.id;
  const savingLabel =
    captureState === 'capturing'
      ? 'Capturing…'
      : captureState === 'uploading'
      ? 'Uploading…'
      : saveMutation.isLoading
      ? 'Saving…'
      : existingLink
      ? 'Update link'
      : 'Save link';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-2">
      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="tagwarden-label">Tags</FormLabel>
                  <span className="text-[11px] text-muted-foreground">
                    Organize first
                  </span>
                </div>
                <TagInput
                  value={field.value ?? []}
                  onChange={field.onChange}
                  tags={tags}
                  suggestedTags={suggestedTags}
                  onManageTags={onManageTags}
                  isLoading={tagsQuery.isLoading}
                  isSearching={
                    Boolean(tagSearch.trim()) &&
                    (tagSearch.trim() !== effectiveSearch ||
                      tagsQuery.isFetching)
                  }
                  isFetchingNextPage={tagsQuery.isFetchingNextPage}
                  hasNextPage={tagsQuery.hasNextPage}
                  onSearchChange={setTagSearch}
                  onReachEnd={() => {
                    if (tagsQuery.hasNextPage && !tagsQuery.isFetchingNextPage)
                      void tagsQuery.fetchNextPage();
                  }}
                  errorMessage={
                    tagsQuery.error
                      ? 'Tags could not be loaded from Linkwarden.'
                      : undefined
                  }
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormItem>
            <FormLabel>Collection</FormLabel>
            <select
              className="tagwarden-select"
              value={selectedCollectionId ?? ''}
              onChange={(event) => {
                const id = Number(event.target.value);
                const collection = collectionsQuery.data?.find(
                  (candidate) => candidate.id === id
                );
                form.setValue(
                  'collection',
                  collection
                    ? {
                        id: collection.id,
                        ownerId: collection.ownerId,
                        name: collection.name,
                      }
                    : { name: 'Unorganized' }
                );
              }}
            >
              <option value="">Unorganized</option>
              {collectionsQuery.data?.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.pathname}
                </option>
              ))}
            </select>
          </FormItem>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Page title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    className="resize-none"
                    placeholder="Why is this link worth keeping?"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!existingLink ? (
            <Label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={uploadImage}
                onCheckedChange={(checked) => {
                  if (checked === 'indeterminate') return;
                  setUploadImage(checked);
                  form.setValue('image', checked ? 'png' : undefined);
                }}
              />
              <Image className="h-4 w-4" />
              Upload a screenshot of this page
            </Label>
          ) : null}

          <div className="sticky bottom-0 -mx-1 flex items-center justify-between border-t bg-background/95 px-1 pt-3 backdrop-blur">
            <span className="min-w-0 truncate pr-3 text-xs text-muted-foreground">
              {existingLink ? 'Already saved — editing' : tabInfo?.url}
            </span>
            <Button
              type="submit"
              className="tagwarden-primary shrink-0"
              disabled={checkingLink || saveMutation.isLoading}
            >
              {checkingLink ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {checkingLink ? 'Checking…' : savingLabel}
            </Button>
          </div>
        </form>
      </Form>
      <Toaster />
    </div>
  );
};

export default BookmarkForm;
