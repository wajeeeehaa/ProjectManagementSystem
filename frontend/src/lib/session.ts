const SESSION_EXPIRED_KEY = 'sessionExpiredMessage';
const SESSION_EXPIRED_MESSAGE = 'session expired';

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
