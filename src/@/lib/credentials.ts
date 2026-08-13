export function normalizeAccessToken(value: string) {
  return value.trim().replace(/^Bearer\s+/i, '').trim();
}

export function extractSessionToken(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const response = (payload as { response?: unknown }).response;

  if (typeof response === 'string') return normalizeAccessToken(response);
  if (!response || typeof response !== 'object') return null;

  const token = (response as { token?: unknown; secretKey?: unknown }).token;
  const secretKey = (response as { secretKey?: unknown }).secretKey;
  const value = typeof token === 'string' ? token : secretKey;

  return typeof value === 'string' && normalizeAccessToken(value)
    ? normalizeAccessToken(value)
    : null;
}
