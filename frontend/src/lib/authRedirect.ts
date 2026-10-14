const PUBLIC_PATHS = new Set(['/login', '/register', '/forgot-password', '/resend-activation']);
const PRIVATE_PATHS = new Set(['/dashboard', '/update-password']);

export function resolveAuthRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (pathname === '/') return isAuthenticated ? '/dashboard' : '/login';
  if (PUBLIC_PATHS.has(pathname) && isAuthenticated) return '/dashboard';
  if (PRIVATE_PATHS.has(pathname) && !isAuthenticated) return '/login';
  return null;
}
