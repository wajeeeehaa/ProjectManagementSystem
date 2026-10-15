const PUBLIC_PATHS = new Set(['/login', '/register', '/forgot-password', '/resend-activation']);
const PRIVATE_PATHS = new Set(['/dashboard', '/update-password']);

const isPrivatePath = (pathname: string) =>
  PRIVATE_PATHS.has(pathname) || pathname === '/workspaces' || pathname.startsWith('/workspaces/');

export function resolveAuthRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (pathname === '/') return isAuthenticated ? '/workspaces' : '/login';
  if (PUBLIC_PATHS.has(pathname) && isAuthenticated) return '/workspaces';
  if (isPrivatePath(pathname) && !isAuthenticated) return '/login';
  return null;
}
