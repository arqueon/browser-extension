export interface ExistingLink {
  id: number;
  url: string;
  name: string;
  description?: string | null;
  collection?: {
    id?: number;
    ownerId?: number;
    name: string;
  };
  tags?: {
    id?: number;
    name: string;
  }[];
}

export function getLinkUrlIdentity(url: string): string {
  return url.trim().replace(/\/+$/, '').replace('://www.', '://');
}

export function findExactLinkByUrl(
  links: ExistingLink[],
  url: string
): ExistingLink | null {
  const identity = getLinkUrlIdentity(url);

  return (
    links.find((link) => getLinkUrlIdentity(link.url) === identity) ?? null
  );
}
