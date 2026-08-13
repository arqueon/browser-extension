import axios from 'axios';

export interface ResponseTags {
  id: number;
  name: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    links: number;
  };
}

export interface TagPolicies {
  archiveAsScreenshot?: boolean | null;
  archiveAsMonolith?: boolean | null;
  archiveAsPDF?: boolean | null;
  archiveAsReadable?: boolean | null;
  archiveAsWaybackMachine?: boolean | null;
  aiTag?: boolean | null;
}

type ConfigResponse = {
  response: {
    INSTANCE_VERSION?: string | null;
  };
};

type LegacyTagsResponse = {
  response:
    | ResponseTags[]
    | { tags: ResponseTags[]; nextCursor?: number | null };
};

type PaginatedTagsResponse = {
  data: {
    tags: ResponseTags[];
    nextCursor?: number | null;
  };
};

const MIN_TAG_PAGINATION_VERSION = '2.14.0';
const MIN_TAG_SEARCH_VERSION = '2.14.1';
const TAG_SORT_NAME_ASC = 2;
const tagFeatureSupportCache = new Map<
  string,
  {
    shouldUsePagination: boolean;
    shouldUseSearch: boolean;
  }
>();

export type TagsPage = {
  tags: ResponseTags[];
  nextCursor: number | null;
};

const normalizeVersion = (version?: string | null) => {
  if (!version) return null;

  return version
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number(part.replace(/\D/g, '')) || 0);
};

const isAtLeastInstanceVersion = (
  version?: string | null,
  minimumVersion?: string | null
) => {
  const normalizedVersion = normalizeVersion(version);
  const normalizedMinimumVersion = normalizeVersion(minimumVersion);

  if (!normalizedVersion || !normalizedMinimumVersion) return false;

  const length = Math.max(
    normalizedVersion.length,
    normalizedMinimumVersion.length
  );

  for (let index = 0; index < length; index++) {
    const left = normalizedVersion[index] ?? 0;
    const right = normalizedMinimumVersion[index] ?? 0;

    if (left > right) return true;
    if (left < right) return false;
  }

  return true;
};

const extractTagsPayload = (
  data: LegacyTagsResponse | PaginatedTagsResponse
): { tags: ResponseTags[]; nextCursor: number | null } => {
  if (Array.isArray((data as LegacyTagsResponse).response)) {
    return {
      tags: (data as LegacyTagsResponse).response as ResponseTags[],
      nextCursor: null,
    };
  }

  if (
    (data as LegacyTagsResponse).response &&
    !Array.isArray((data as LegacyTagsResponse).response)
  ) {
    const response = (data as LegacyTagsResponse).response as {
      tags: ResponseTags[];
      nextCursor?: number | null;
    };

    return {
      tags: response.tags,
      nextCursor: response.nextCursor ?? null,
    };
  }

  const response = (data as PaginatedTagsResponse).data;

  return {
    tags: response.tags,
    nextCursor: response.nextCursor ?? null,
  };
};

const getInstanceVersion = async (baseUrl: string, apiKey: string) => {
  try {
    const response = await axios.get<ConfigResponse>(
      `${baseUrl}/api/v1/config`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    return response.data.response.INSTANCE_VERSION ?? null;
  } catch (_error) {
    return null;
  }
};

const getTagFeatureSupportCacheKey = (baseUrl: string, apiKey: string) =>
  `${baseUrl}::${apiKey}`;

const getTagFeatures = async (baseUrl: string, apiKey: string) => {
  const cacheKey = getTagFeatureSupportCacheKey(baseUrl, apiKey);
  const cachedValue = tagFeatureSupportCache.get(cacheKey);

  if (cachedValue !== undefined) return cachedValue;

  const instanceVersion = await getInstanceVersion(baseUrl, apiKey);
  const nextValue = {
    shouldUsePagination: isAtLeastInstanceVersion(
      instanceVersion,
      MIN_TAG_PAGINATION_VERSION
    ),
    shouldUseSearch: isAtLeastInstanceVersion(
      instanceVersion,
      MIN_TAG_SEARCH_VERSION
    ),
  };

  tagFeatureSupportCache.set(cacheKey, nextValue);

  return nextValue;
};

export const getShouldUseTagSearch = async (baseUrl: string, apiKey: string) =>
  (await getTagFeatures(baseUrl, apiKey)).shouldUseSearch;

export async function getTags(
  baseUrl: string,
  apiKey: string,
  cursor = 0,
  search = '',
  signal?: AbortSignal
): Promise<TagsPage> {
  const { shouldUsePagination, shouldUseSearch } = await getTagFeatures(
    baseUrl,
    apiKey
  );

  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };

  const searchParams = new URLSearchParams();
  const normalizedSearch = search.trim();
  searchParams.set('sort', String(TAG_SORT_NAME_ASC));

  if (shouldUsePagination) {
    searchParams.set('cursor', String(cursor));
  }

  if (shouldUseSearch && normalizedSearch) {
    searchParams.set('search', normalizedSearch);
  }

  const initialResponse = await axios.get<
    LegacyTagsResponse | PaginatedTagsResponse
  >(`${baseUrl}/api/v1/tags?${searchParams.toString()}`, {
    headers,
    signal,
  });

  const payload = extractTagsPayload(initialResponse.data);

  return {
    tags: payload.tags,
    nextCursor: shouldUsePagination ? payload.nextCursor : null,
  };
}

export async function getAllTags(baseUrl: string, apiKey: string) {
  const tags: ResponseTags[] = [];
  let cursor = 0;

  for (let page = 0; page < 100; page += 1) {
    const result = await getTags(baseUrl, apiKey, cursor);
    tags.push(...result.tags);

    if (result.nextCursor === null) break;
    cursor = result.nextCursor;
  }

  return tags;
}

const authHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

export async function createTag(
  baseUrl: string,
  apiKey: string,
  name: string,
  policies: TagPolicies = {}
) {
  const response = await axios.post<{ response: ResponseTags[] }>(
    `${baseUrl}/api/v1/tags`,
    {
      tags: [
        {
          label: name,
          archiveAsScreenshot: policies.archiveAsScreenshot ?? null,
          archiveAsMonolith: policies.archiveAsMonolith ?? null,
          archiveAsPDF: policies.archiveAsPDF ?? null,
          archiveAsReadable: policies.archiveAsReadable ?? null,
          archiveAsWaybackMachine:
            policies.archiveAsWaybackMachine ?? null,
          aiTag: policies.aiTag ?? null,
        },
      ],
    },
    { headers: authHeaders(apiKey) }
  );

  return response.data.response[0];
}

export async function renameTag(
  baseUrl: string,
  apiKey: string,
  id: number,
  name: string
) {
  const response = await axios.put<{ response: ResponseTags }>(
    `${baseUrl}/api/v1/tags/${id}`,
    { name },
    { headers: authHeaders(apiKey) }
  );

  return response.data.response;
}

export async function deleteTags(
  baseUrl: string,
  apiKey: string,
  tagIds: number[]
) {
  return await axios.delete(`${baseUrl}/api/v1/tags`, {
    data: { tagIds },
    headers: authHeaders(apiKey),
  });
}

export async function mergeTags(
  baseUrl: string,
  apiKey: string,
  tagIds: number[],
  newTagName: string
) {
  return await axios.put(
    `${baseUrl}/api/v1/tags/merge`,
    { tagIds, newTagName },
    { headers: authHeaders(apiKey) }
  );
}
