import { describe, expect, it } from 'vitest';
import {
  extractSessionToken,
  normalizeAccessToken,
} from '../src/@/lib/credentials.ts';

describe('Linkwarden credentials', () => {
  it('accepts a raw access token or a copied Bearer header', () => {
    expect(normalizeAccessToken('  token.value  ')).toBe('token.value');
    expect(normalizeAccessToken('Bearer token.value')).toBe('token.value');
    expect(normalizeAccessToken('bearer   token.value')).toBe('token.value');
  });

  it('reads current and compatible session response shapes', () => {
    expect(extractSessionToken({ response: { token: 'session.token' } })).toBe(
      'session.token'
    );
    expect(
      extractSessionToken({ response: { secretKey: 'access.token' } })
    ).toBe('access.token');
  });

  it('rejects responses without a usable token', () => {
    expect(extractSessionToken({ response: {} })).toBeNull();
    expect(extractSessionToken(undefined)).toBeNull();
  });
});
