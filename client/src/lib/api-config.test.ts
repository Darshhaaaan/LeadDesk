import { afterEach, describe, expect, it, vi } from 'vitest';

const importConfig = async (baseUrl: string) => {
  vi.resetModules();
  vi.stubEnv('VITE_API_BASE_URL', baseUrl);
  return import('./api-config');
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('API base URL configuration', () => {
  it('uses relative URLs when VITE_API_BASE_URL is empty', async () => {
    const { API_BASE_URL, buildApiUrl } = await importConfig('');

    expect(API_BASE_URL).toBe('');
    expect(buildApiUrl('/api/auth/csrf')).toBe('/api/auth/csrf');
  });

  it('prefixes every request with the configured backend origin', async () => {
    const { API_BASE_URL, buildApiUrl } = await importConfig('https://backend.example.com/');

    expect(API_BASE_URL).toBe('https://backend.example.com');
    expect(buildApiUrl('/api/auth/register')).toBe(
      'https://backend.example.com/api/auth/register'
    );
    expect(buildApiUrl('api/leads')).toBe('https://backend.example.com/api/leads');
  });

  it('accepts a base URL that includes /api without duplicating it', async () => {
    const { buildApiUrl } = await importConfig('https://backend.example.com/api/');

    expect(buildApiUrl('/api/leads/stats')).toBe(
      'https://backend.example.com/api/leads/stats'
    );
  });

  it('adds https:// when the configured origin has no scheme', async () => {
    const { API_BASE_URL } = await importConfig('backend.example.com');

    expect(API_BASE_URL).toBe('https://backend.example.com');
  });

  it('rejects unsupported protocols', async () => {
    await expect(importConfig('ftp://backend.example.com')).rejects.toThrow(
      'must use http:// or https://'
    );
  });
});
