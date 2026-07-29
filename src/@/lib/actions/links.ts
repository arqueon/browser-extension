import captureScreenshot from '../screenshot.ts';
import { bookmarkFormValues } from '../validators/bookmarkForm.ts';
import axios from 'axios';
// import { bookmarkMetadata } from '../cache.ts';
import { getBrowser, getCurrentTabInfo } from '../utils.ts';
import {
  ExistingLink,
  findExactLinkByUrl,
  getLinkUrlIdentity,
} from '../link-utils.ts';

interface RecentlySavedLink {
  baseUrl: string;
  cachedAt: number;
  link: ExistingLink;
}

const RECENTLY_SAVED_LINKS_KEY = 'lw_recently_saved_links';
const RECENTLY_SAVED_LINK_TTL_MS = 15 * 60 * 1000;
const RECENTLY_SAVED_LINK_LIMIT = 50;

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

async function getRecentlySavedLinks(): Promise<RecentlySavedLink[]> {
  const stored = await getBrowser().storage.local.get([
    RECENTLY_SAVED_LINKS_KEY,
  ]);
  const links = stored[RECENTLY_SAVED_LINKS_KEY];

  return Array.isArray(links) ? links : [];
}

async function getRecentlySavedLink(
  baseUrl: string,
  url: string
): Promise<ExistingLink | null> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const now = Date.now();
  const links = await getRecentlySavedLinks();
  const cached = links.find(
    (entry) =>
      entry.baseUrl === normalizedBaseUrl &&
      getLinkUrlIdentity(entry.link.url) === getLinkUrlIdentity(url) &&
      now - entry.cachedAt <= RECENTLY_SAVED_LINK_TTL_MS
  );

  return cached?.link ?? null;
}

export async function rememberSavedLink(
  baseUrl: string,
  link: ExistingLink
) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const now = Date.now();
  const links = (await getRecentlySavedLinks()).filter(
    (entry) =>
      now - entry.cachedAt <= RECENTLY_SAVED_LINK_TTL_MS &&
      !(
        entry.baseUrl === normalizedBaseUrl &&
        (entry.link.id === link.id ||
          getLinkUrlIdentity(entry.link.url) ===
            getLinkUrlIdentity(link.url))
      )
  );

  await getBrowser().storage.local.set({
    [RECENTLY_SAVED_LINKS_KEY]: [
      {
        baseUrl: normalizedBaseUrl,
        cachedAt: now,
        link,
      },
      ...links,
    ].slice(0, RECENTLY_SAVED_LINK_LIMIT),
  });
}

export async function postLink(
  baseUrl: string,
  uploadImage: boolean,
  data: bookmarkFormValues,
  setState: (state: 'capturing' | 'uploading' | null) => void,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links`;

  if (uploadImage) {
    setState('capturing');
    const screenshot = await captureScreenshot();
    setState('uploading');

    const link = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const { id } = link.data.response;
    const archiveUrl = `${baseUrl}/api/v1/archives/${id}?format=0`;

    const formData = new FormData();
    formData.append('file', screenshot, 'screenshot.png');

    await axios.post(archiveUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    setState(null);

    return link;
  } else {
    return await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }
}

export async function postLinkFetch(
  baseUrl: string,
  data: bookmarkFormValues,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links`;

  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function updateLink(
  baseUrl: string,
  id: number,
  data: bookmarkFormValues,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links/${id}`;

  return await axios.put(url, data, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function updateLinkFetch(
  baseUrl: string,
  id: number,
  data: bookmarkFormValues,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links/${id}`;

  return await fetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function deleteLinkFetch(
  baseUrl: string,
  id: number,
  apiKey: string
) {
  const url = `${baseUrl}/api/v1/links/${id}`;

  return await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

// export async function getLinksFetch(
//   baseUrl: string,
//   apiKey: string
// ): Promise<{ response: bookmarkMetadata[] }> {
//   const url = `${baseUrl}/api/v1/links`;
//   const response = await fetch(url, {
//     headers: {
//       Authorization: `Bearer ${apiKey}`,
//     },
//   });
//   return await response.json();
// }

export async function getLinkByUrl(
  baseUrl: string,
  apiKey: string,
  targetUrl?: string
): Promise<ExistingLink | null> {
  const tabInfo = targetUrl ? null : await getCurrentTabInfo();
  const currentUrl = targetUrl ?? tabInfo?.url;

  if (!currentUrl) {
    console.error('No URL found for current tab');
    return null;
  }

  let recentlySavedLink: ExistingLink | null = null;
  try {
    recentlySavedLink = await getRecentlySavedLink(baseUrl, currentUrl);
  } catch (error) {
    console.warn('Could not read the recently saved link cache', error);
  }
  const url =
    `${baseUrl}/api/v1/search?sort=0&searchQueryString=` +
    encodeURIComponent(`url:${currentUrl}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Link lookup failed with status ${response.status}`);
    }

    const { data } = await response.json();
    const links = Array.isArray(data?.links)
      ? (data.links as ExistingLink[])
      : [];
    const existingLink = findExactLinkByUrl(links, currentUrl);

    if (existingLink) {
      try {
        await rememberSavedLink(baseUrl, existingLink);
      } catch (error) {
        console.warn('Could not update the recently saved link cache', error);
      }
      return existingLink;
    }

    return recentlySavedLink;
  } catch (error) {
    if (recentlySavedLink) return recentlySavedLink;
    throw error;
  }
}

export async function checkLinkExists(
  baseUrl: string,
  apiKey: string
): Promise<boolean> {
  return Boolean(await getLinkByUrl(baseUrl, apiKey));
}
