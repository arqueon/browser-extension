import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { describeConnectionError } from '../src/@/lib/connection-error.ts';

describe('connection diagnostics', () => {
  it('turns an opaque network failure into actionable checks', () => {
    const message = describeConnectionError(
      new AxiosError('Network Error'),
      'https://192.168.1.20:3443'
    );

    expect(message).toContain('https://192.168.1.20:3443');
    expect(message).toContain('certificate warnings');
    expect(message).toContain('host, port, and reverse proxy');
    expect(message).not.toBe('Network error: Network Error');
  });
});
