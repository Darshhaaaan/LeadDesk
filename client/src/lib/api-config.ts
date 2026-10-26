const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

const normalizeApiBaseUrl = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return '';
  }

  const stripApiPath = (path: string): string => (path === '/api' ? '' : path);

  if (trimmed.startsWith('/')) {
    return stripApiPath(stripTrailingSlashes(trimmed));
  }

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`VITE_API_BASE_URL is not a valid URL: "${trimmed}"`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use http:// or https://.');
  }

  // Every request path already includes /api, so accept a base URL with or
  // without a trailing /api without producing /api/api/... URLs.
  return `${url.origin}${stripApiPath(stripTrailingSlashes(url.pathname))}`;
};

/**
 * API origin configured at build time.
 *
 * Leave VITE_API_BASE_URL empty for same-origin deployments and local
 * development through the Vite proxy. For a separately hosted API, set it to
 * the backend origin (for example https://leadapp-api.onrender.com) in Vercel
 * and redeploy so Vite can embed the value in the production bundle.
 */
export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};
