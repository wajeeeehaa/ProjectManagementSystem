export const CSRF_COOKIE_NAME = 'csrfToken';

export function readCookie(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  return readCookie(document.cookie, CSRF_COOKIE_NAME);
}
