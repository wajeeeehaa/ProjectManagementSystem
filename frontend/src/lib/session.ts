const SESSION_EXPIRED_KEY = 'sessionExpiredMessage';
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Log in again.';
const AUTH_NOTICE_KEY = 'authNotice';

export function storeSessionExpiredMessage() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_EXPIRED_KEY, SESSION_EXPIRED_MESSAGE);
}

export function consumeSessionExpiredMessage(): string | null {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem(SESSION_EXPIRED_KEY);
  if (!value) return null;
  sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  return value;
}

export function storeAuthNotice(message: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(AUTH_NOTICE_KEY, message);
}

export function consumeAuthNotice(): string | null {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem(AUTH_NOTICE_KEY);
  if (!value) return null;
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return value;
}
