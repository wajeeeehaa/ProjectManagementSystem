const storageKey = process.env.NEXT_PUBLIC_ACCESS_TOKEN_STORAGE_KEY?.trim() ?? '';
const cookieName = process.env.NEXT_PUBLIC_ACCESS_TOKEN_COOKIE_NAME?.trim() ?? '';
const maxAge = process.env.NEXT_PUBLIC_ACCESS_TOKEN_MAX_AGE?.trim() ?? '';

function readCookie(name: string): string | null {
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      const value = rawValue.join('=').trim();
      if (!value) return null;
      return decodeURIComponent(value);
    }
  }
  return null;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  if (storageKey) {
    const fromStorage = localStorage.getItem(storageKey);
    if (fromStorage) return fromStorage;
  }

  if (cookieName) {
    const fromCookie = readCookie(cookieName);
    if (fromCookie) return fromCookie;
  }

  return null;
}

export function setAccessToken(token: string) {
  if (typeof window === 'undefined') return;

  if (storageKey) {
    localStorage.setItem(storageKey, token);
  }

  if (cookieName && maxAge) {
    document.cookie = `${cookieName}=${encodeURIComponent(token)}; path=/; SameSite=Lax; max-age=${maxAge}`;
  }
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;

  if (storageKey) {
    localStorage.removeItem(storageKey);
  }

  if (cookieName) {
    document.cookie = `${cookieName}=; path=/; SameSite=Lax; max-age=0`;
  }
}
