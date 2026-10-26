import type {
  ChangePasswordPayload,
  CreateLeadPayload,
  Lead,
  LeadActivity,
  LeadFilters,
  LeadList,
  LeadStats,
  LoginPayload,
  RegisterPayload,
  UpdateLeadPayload,
  User,
} from './types';

export const AUTH_UNAUTHORIZED_EVENT = 'leadapp:unauthorized';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

let csrfToken: string | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

const buildUrl = (path: string): string => {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isApiResponse = <T>(value: unknown): value is ApiResponse<T> => {
  if (!value || typeof value !== 'object' || !('success' in value)) {
    return false;
  }
  return true;
};

const fetchCsrfToken = async (force = false): Promise<string> => {
  if (csrfToken && !force) {
    return csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl('/api/auth/csrf'), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.');
  }

  const payload = await parseJson(response);

  if (!response.ok || !isApiResponse<{ csrfToken: string }>(payload) || !payload.success) {
    const message =
      isApiResponse<unknown>(payload) && !payload.success
        ? payload.error.message
        : 'Could not prepare a secure request. Please refresh the page.';
    throw new ApiError(response.status, 'CSRF_SETUP_FAILED', message);
  }

  csrfToken = payload.data.csrfToken;
  return csrfToken;
};

interface RequestOptions {
  signal?: AbortSignal;
}

const SESSION_ERROR_CODES = new Set(['UNAUTHENTICATED', 'INVALID_TOKEN']);

const execute = async <T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: RequestOptions = {},
  allowCsrfRetry = true
): Promise<T> => {
  const unsafe = method !== 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (unsafe) {
    headers['X-XSRF-TOKEN'] = await fetchCsrfToken();
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.');
  }

  const payload = await parseJson(response);

  if (response.status === 403 && isApiResponse<unknown>(payload) && !payload.success) {
    if (payload.error.code === 'CSRF_ERROR' && unsafe && allowCsrfRetry) {
      csrfToken = null;
      await fetchCsrfToken(true);
      return execute<T>(method, path, body, options, false);
    }
  }

  if (!isApiResponse<T>(payload)) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unexpected response. Please try again.'
    );
  }

  if (!response.ok || !payload.success) {
    if (!payload.success) {
      // Only signals that the session itself is invalid end the local session.
      // A 401 for a wrong current password or login attempt must stay on screen
      // so the user can correct it.
      if (response.status === 401 && SESSION_ERROR_CODES.has(payload.error.code)) {
        window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
      }
      throw new ApiError(response.status, payload.error.code, payload.error.message);
    }
  }

  return payload.data;
};

const toQueryString = (filters: LeadFilters): string => {
  const params = new URLSearchParams();

  const append = (key: string, value: string | number | undefined): void => {
    if (value === undefined || value === '') {
      return;
    }
    params.set(key, String(value));
  };

  append('page', filters.page);
  append('pageSize', filters.pageSize);
  append('search', filters.search?.trim());
  append('status', filters.status);
  append('createdFrom', filters.createdFrom);
  append('createdTo', filters.createdTo);
  append('followUpFrom', filters.followUpFrom);
  append('followUpTo', filters.followUpTo);
  append('sortBy', filters.sortBy);
  append('sortOrder', filters.sortOrder);

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const api = {
  register: (payload: RegisterPayload): Promise<{ user: User }> =>
    execute('POST', '/api/auth/register', payload),

  login: (payload: LoginPayload): Promise<{ user: User }> =>
    execute('POST', '/api/auth/login', payload),

  logout: (): Promise<{ message: string }> => execute('POST', '/api/auth/logout'),

  me: (options?: RequestOptions): Promise<{ user: User }> =>
    execute('GET', '/api/auth/me', undefined, options),

  forgotPassword: (email: string): Promise<{ message: string }> =>
    execute('POST', '/api/auth/forgot-password', { email }),

  resetPassword: (payload: {
    token: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ message: string }> => execute('POST', '/api/auth/reset-password', payload),

  changePassword: (payload: ChangePasswordPayload): Promise<{ message: string }> =>
    execute('POST', '/api/auth/change-password', payload),

  deleteAccount: (currentPassword: string): Promise<{ message: string }> =>
    execute('DELETE', '/api/auth/account', { currentPassword }),

  listLeads: (filters: LeadFilters, options?: RequestOptions): Promise<LeadList> =>
    execute('GET', `/api/leads${toQueryString(filters)}`, undefined, options),

  getLead: (id: string, options?: RequestOptions): Promise<{ lead: Lead }> =>
    execute('GET', `/api/leads/${encodeURIComponent(id)}`, undefined, options),

  getLeadActivities: (id: string, options?: RequestOptions): Promise<{ activities: LeadActivity[] }> =>
    execute('GET', `/api/leads/${encodeURIComponent(id)}/activities`, undefined, options),

  createLead: (payload: CreateLeadPayload): Promise<{ lead: Lead }> =>
    execute('POST', '/api/leads', payload),

  updateLead: (id: string, payload: UpdateLeadPayload): Promise<{ lead: Lead }> =>
    execute('PATCH', `/api/leads/${encodeURIComponent(id)}`, payload),

  deleteLead: (id: string): Promise<{ message: string }> =>
    execute('DELETE', `/api/leads/${encodeURIComponent(id)}`),

  getLeadStats: (options?: RequestOptions): Promise<{ stats: LeadStats }> =>
    execute('GET', '/api/leads/stats', undefined, options),
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
};
