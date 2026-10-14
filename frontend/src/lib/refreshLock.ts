export const REFRESH_LOCK_KEY = 'pms.refreshLock';
const LOCK_TTL_MS = 5000;

export function classifyRefreshLock(raw: string | null, now: number): 'take' | 'wait' {
  if (!raw) return 'take';
  try {
    const parsed = JSON.parse(raw) as { expires?: unknown };
    if (typeof parsed.expires !== 'number' || parsed.expires <= now) return 'take';
    return 'wait';
  } catch {
    return 'take';
  }
}

function waitForUnlock(): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('storage', onStorage);
      resolve();
    }, LOCK_TTL_MS);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== REFRESH_LOCK_KEY || event.newValue) return;
      window.clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
      resolve();
    };

    window.addEventListener('storage', onStorage);
  });
}

export async function refreshWithLock(refresh: () => Promise<boolean>): Promise<boolean> {
  if (typeof window === 'undefined') return refresh();

  let current: string | null = null;
  try {
    current = window.localStorage.getItem(REFRESH_LOCK_KEY);
  } catch {
    return refresh();
  }

  if (classifyRefreshLock(current, Date.now()) === 'wait') {
    await waitForUnlock();
    return true;
  }

  try {
    window.localStorage.setItem(
      REFRESH_LOCK_KEY,
      JSON.stringify({ expires: Date.now() + LOCK_TTL_MS }),
    );
  } catch {
    return refresh();
  }

  try {
    return await refresh();
  } finally {
    try {
      window.localStorage.removeItem(REFRESH_LOCK_KEY);
    } catch {
      // The lock expires on its own if storage is unavailable while releasing it.
    }
  }
}
