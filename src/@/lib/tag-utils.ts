export type TagOption = {
  id?: number;
  name: string;
};

export const normalizeTagName = (name: string) =>
  name.trim().replace(/\s+/g, ' ');

export const getTagIdentity = (name: string) =>
  normalizeTagName(name).toLocaleLowerCase();

export const isSameTagName = (left: string, right: string) =>
  getTagIdentity(left) === getTagIdentity(right);

export const dedupeTags = <T extends TagOption>(tags: T[]) => {
  const uniqueTags = new Map<string, T>();

  for (const tag of tags) {
    const identity = getTagIdentity(tag.name);
    if (identity && !uniqueTags.has(identity)) uniqueTags.set(identity, tag);
  }

  return [...uniqueTags.values()];
};

const getMatchScore = (tagName: string, query: string) => {
  const normalizedTagName = getTagIdentity(tagName);
  const normalizedQuery = getTagIdentity(query);

  if (normalizedTagName === normalizedQuery) return 0;
  if (normalizedTagName.startsWith(normalizedQuery)) return 1;

  const words = normalizedTagName.split(/\s+/);
  if (words.some((word) => word.startsWith(normalizedQuery))) return 2;

  return 3;
};

export const filterAndSortTags = <T extends TagOption>(
  tags: T[],
  query: string
) => {
  const normalizedQuery = getTagIdentity(query);
  const uniqueTags = dedupeTags(tags);

  const matchingTags = normalizedQuery
    ? uniqueTags.filter((tag) =>
        getTagIdentity(tag.name).includes(normalizedQuery)
      )
    : uniqueTags;

  return matchingTags.sort((left, right) => {
    if (normalizedQuery) {
      const scoreDifference =
        getMatchScore(left.name, normalizedQuery) -
        getMatchScore(right.name, normalizedQuery);

      if (scoreDifference !== 0) return scoreDifference;
    }

    return left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base',
    });
  });
};

export const findExactTag = <T extends TagOption>(
  tags: T[],
  query: string
) => tags.find((tag) => isSameTagName(tag.name, query));

export const getCreatableTagName = (
  query: string,
  availableTags: TagOption[],
  selectedTags: TagOption[]
) => {
  const normalizedName = normalizeTagName(query);

  if (!normalizedName) return null;
  if (findExactTag([...availableTags, ...selectedTags], normalizedName))
    return null;

  return normalizedName;
};

export const addPendingTagSelection = (
  selectedTags: TagOption[],
  availableTags: TagOption[],
  query: string
) => {
  const name = getCreatableTagName(query, availableTags, selectedTags);

  if (!name) return selectedTags;

  return [...selectedTags, { name }];
};

export const toggleTagSelection = <T extends TagOption>(
  selectedTags: T[],
  tag: T
) => {
  const isSelected = selectedTags.some((selectedTag) =>
    isSameTagName(selectedTag.name, tag.name)
  );

  if (isSelected) {
    return selectedTags.filter(
      (selectedTag) => !isSameTagName(selectedTag.name, tag.name)
    );
  }

  return [...selectedTags, tag];
};

export const removeTagSelection = <T extends TagOption>(
  selectedTags: T[],
  tagName: string
) =>
  selectedTags.filter(
    (selectedTag) => !isSameTagName(selectedTag.name, tagName)
  );
