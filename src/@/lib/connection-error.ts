import { AxiosError } from 'axios';

const readableResponse = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
};

function readableOrigin(baseUrl: string) {
  try {
    return new URL(baseUrl).origin;
  } catch (_error) {
    return 'the Linkwarden instance';
  }
}

export function describeConnectionError(error: unknown, baseUrl: string) {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const serverMessage = readableResponse(error.response?.data?.response);
    if (status) return `HTTP ${status}: ${serverMessage || error.message}`;

    return (
      `Network error: the browser could not reach ${readableOrigin(baseUrl)}. ` +
      'Open that address in a browser tab and confirm that it loads without ' +
      'certificate warnings, then check the host, port, and reverse proxy.'
    );
  }
  return error instanceof Error ? error.message : 'Could not connect to Linkwarden.';
}
