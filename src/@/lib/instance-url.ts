export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

function parseIpv4(hostname: string) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => Number(part));
  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== parts[index]
    )
  )
    return null;

  return octets;
}

export function isLoopbackHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1'
  )
    return true;

  const ipv4 = parseIpv4(normalized);
  return ipv4?.[0] === 127;
}

export function isPrivateNetworkHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (isLoopbackHostname(normalized)) return true;

  const ipv4 = parseIpv4(normalized);
  if (ipv4) {
    const [first, second] = ipv4;
    return (
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254) ||
      (first === 100 && second >= 64 && second <= 127)
    );
  }

  if (/^f[cd][0-9a-f]{0,2}:/.test(normalized)) return true;
  if (/^fe[89ab][0-9a-f]?:/.test(normalized)) return true;

  return (
    normalized.endsWith('.local') ||
    normalized === 'home.arpa' ||
    normalized.endsWith('.home.arpa') ||
    (/^[a-z0-9-]+$/.test(normalized) && !normalized.includes('.'))
  );
}

export function isSecureInstanceUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && isLoopbackHostname(url.hostname))
    );
  } catch (_error) {
    return false;
  }
}

export function isInsecureLocalInstanceUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    return (
      url.protocol === 'http:' &&
      !isLoopbackHostname(url.hostname) &&
      isPrivateNetworkHostname(url.hostname)
    );
  } catch (_error) {
    return false;
  }
}

export function isAllowedInstanceUrl(
  baseUrl: string,
  allowInsecureHttp = false
) {
  return (
    isSecureInstanceUrl(baseUrl) ||
    (allowInsecureHttp && isInsecureLocalInstanceUrl(baseUrl))
  );
}

export function getInstancePermissionPattern(
  baseUrl: string,
  extensionUrl: string
) {
  const url = new URL(baseUrl);
  if (extensionUrl.startsWith('moz-extension:'))
    return `${url.protocol}//${url.hostname}/*`;

  return `${url.origin}/*`;
}
