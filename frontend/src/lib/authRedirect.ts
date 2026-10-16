const PUBLIC_PATHS = new Set(['/login', '/register', '/forgot-password', '/resend-activation']);
const PRIVATE_PATHS = new Set(['/dashboard', '/update-password']);

export const WORKSPACE_RESUME_PATH = '/workspaces/resume';

const isPrivatePath = (pathname: string) =>
  PRIVATE_PATHS.has(pathname) ||
  pathname === '/workspaces' ||
  pathname.startsWith('/workspaces/') ||
  pathname === '/activity' ||
  pathname.startsWith('/activity/');

export function resolveAuthRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (pathname === '/') return isAuthenticated ? WORKSPACE_RESUME_PATH : '/login';
  if (PUBLIC_PATHS.has(pathname) && isAuthenticated) return WORKSPACE_RESUME_PATH;
  if (isPrivatePath(pathname) && !isAuthenticated) return '/login';
  return null;
}
