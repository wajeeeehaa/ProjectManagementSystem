import { signedOut } from './authSlice';
import { getCsrfToken } from './csrf';
import { refreshWithLock } from './refreshLock';
import { storeSessionExpiredMessage } from './session';
import { REFRESH_PATH, shouldAttemptRefresh } from './sessionPolicy';
import { store } from './store';

type IssueMessage = {
  message?: unknown;
};

type Envelope = {
  success: boolean;
  statusCode: number;
  message: unknown;
  data: unknown;
};

type RequestOptions = RequestInit & {
  retry?: boolean;
  redirectOnUnauthorized?: boolean;
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export function messageFromEnvelope(message: unknown): string {
  if (Array.isArray(message)) {
    const messages = message
      .map((issue) => {
        const value = issue as IssueMessage;
        return typeof value.message === 'string' ? value.message : '';
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join(' ');
  }

  if (typeof message === 'string' && message.trim()) return message;
  return 'Request failed';
}

function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
}

let refreshInFlight: Promise<boolean> | null = null;

async function postRefresh(): Promise<boolean> {
  const headers = new Headers();
  const csrf = getCsrfToken();
  if (csrf) headers.set('X-CSRF-Token', csrf);
  try {
    const response = await fetch(`${apiBaseUrl()}${REFRESH_PATH}`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshWithLock(postRefresh).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { retry = true, redirectOnUnauthorized = false, ...init } = options;
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (UNSAFE_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      method,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Unable to reach the server', 0);
  }

  let body: Envelope | null = null;
  try {
    body = (await response.json()) as Envelope;
  } catch {
    body = null;
  }

  if (shouldAttemptRefresh(path, response.status, retry)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retry: false });
    }
    if (redirectOnUnauthorized && typeof window !== 'undefined') {
      storeSessionExpiredMessage();
      store.dispatch(signedOut());
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    throw new ApiError(messageFromEnvelope(body?.message), 401);
  }

  if (!response.ok || !body?.success) {
    throw new ApiError(messageFromEnvelope(body?.message), body?.statusCode ?? response.status);
  }

  return body.data as T;
}
