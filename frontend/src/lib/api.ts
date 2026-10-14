import { clearAccessToken, getAccessToken } from './token';
import { storeSessionExpiredMessage } from './session';

type IssueMessage = {
  message?: unknown;
};

type Envelope = {
  success: boolean;
  statusCode: number;
  message: unknown;
  data: unknown;
};

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

function messageFromEnvelope(message: unknown): string {
  if (Array.isArray(message)) {
    const first = message[0] as IssueMessage | undefined;
    if (first && typeof first.message === 'string') {
      return first.message;
    }
  }

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return 'Request failed';
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? '';
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is empty');
  }

  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  let body: Envelope | null = null;
  try {
    body = (await response.json()) as Envelope;
  } catch {
    body = null;
  }

  if (response.status === 401) {
    clearAccessToken();
    storeSessionExpiredMessage();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new ApiError(messageFromEnvelope(body?.message), 401);
  }

  if (!response.ok || !body?.success) {
    throw new ApiError(
      messageFromEnvelope(body?.message),
      body?.statusCode ?? response.status,
    );
  }

  return body.data as T;
}
