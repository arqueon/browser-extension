import { describe, expect, it } from 'vitest';
import {
  getInstancePermissionPattern,
  isAllowedInstanceUrl,
  isInsecureLocalInstanceUrl,
  isPrivateNetworkHostname,
  isSecureInstanceUrl,
  normalizeBaseUrl,
} from '../src/@/lib/instance-url.ts';

describe('Linkwarden instance URLs', () => {
  it('normalizes surrounding whitespace and trailing slashes', () => {
    expect(normalizeBaseUrl('  https://links.example.org/// ')).toBe(
      'https://links.example.org'
    );
  });

  it('accepts HTTPS and local HTTP', () => {
    expect(isSecureInstanceUrl('https://links.example.org')).toBe(true);
    expect(isSecureInstanceUrl('http://localhost:3000')).toBe(true);
    expect(isSecureInstanceUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isSecureInstanceUrl('http://127.42.0.8:3000')).toBe(true);
    expect(isSecureInstanceUrl('http://[::1]:3000')).toBe(true);
  });

  it('recognizes private and local-network HTTP addresses', () => {
    for (const url of [
      'http://10.20.30.40:3000',
      'http://172.31.4.5:3000',
      'http://192.168.1.20:3000',
      'http://169.254.10.20:3000',
      'http://100.100.20.30:3000',
      'http://[fd12:3456::20]:3000',
      'http://[fe80::20]:3000',
      'http://linkwarden.local:3000',
      'http://linkwarden.home.arpa:3000',
      'http://linkwarden:3000',
    ]) {
      expect(isInsecureLocalInstanceUrl(url), url).toBe(true);
    }
  });

  it('requires explicit consent before allowing private HTTP', () => {
    const url = 'http://192.168.1.20:3000';
    expect(isAllowedInstanceUrl(url)).toBe(false);
    expect(isAllowedInstanceUrl(url, true)).toBe(true);
    expect(isAllowedInstanceUrl('https://192.168.1.20:3443')).toBe(true);
    expect(isAllowedInstanceUrl('http://8.8.8.8:3000', true)).toBe(false);
  });

  it('rejects public plaintext HTTP and invalid values', () => {
    expect(isSecureInstanceUrl('http://192.168.1.20:3000')).toBe(false);
    expect(isInsecureLocalInstanceUrl('http://8.8.8.8:3000')).toBe(false);
    expect(isInsecureLocalInstanceUrl('http://links.example.org')).toBe(false);
    expect(isSecureInstanceUrl('not a URL')).toBe(false);
  });

  it('does not mistake neighboring public ranges for private networks', () => {
    expect(isPrivateNetworkHostname('172.15.0.1')).toBe(false);
    expect(isPrivateNetworkHostname('172.32.0.1')).toBe(false);
    expect(isPrivateNetworkHostname('100.63.0.1')).toBe(false);
    expect(isPrivateNetworkHostname('100.128.0.1')).toBe(false);
  });

  it('omits ports from Firefox permission patterns only', () => {
    const baseUrl = 'https://192.168.1.20:3443';
    expect(
      getInstancePermissionPattern(baseUrl, 'moz-extension://tagwarden/')
    ).toBe('https://192.168.1.20/*');
    expect(
      getInstancePermissionPattern(baseUrl, 'chrome-extension://tagwarden/')
    ).toBe('https://192.168.1.20:3443/*');
  });

  it('preserves IPv6 brackets in Firefox permission patterns', () => {
    expect(
      getInstancePermissionPattern(
        'http://[fd12:3456::20]:3000',
        'moz-extension://tagwarden/'
      )
    ).toBe('http://[fd12:3456::20]/*');
  });
});
