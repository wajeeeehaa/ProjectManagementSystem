export const REFRESH_PATH = '/api/auth/refresh-token';

const NO_REFRESH_EXACT = new Set([
  '/api/auth/login',
  '/api/auth/register',
  REFRESH_PATH,
  '/api/auth/refresh-token-mobile',
  '/api/auth/reset-password',
  '/api/auth/logout',
]);

export function shouldAttemptRefresh(path: string, status: number, retry: boolean): boolean {
  if (status !== 401 || !retry) return false;
  const pathname = path.split('?')[0];
  if (pathname.startsWith('/api/auth/verify/')) return false;
  if (pathname.startsWith('/api/auth/new-activation-link/')) return false;
  if (pathname.startsWith('/api/auth/reset-password-link/')) return false;
  return !NO_REFRESH_EXACT.has(pathname);
}
