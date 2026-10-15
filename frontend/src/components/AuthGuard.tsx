'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { resolveAuthRedirect } from '../lib/authRedirect';
import type { RootState } from '../lib/store';

export function AuthGuard({
  mode,
  children,
}: {
  mode: 'public' | 'private' | 'any';
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const authReady = useSelector((state: RootState) => state.auth.authReady);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const redirectTo =
    authReady && mode !== 'any' ? resolveAuthRedirect(pathname, isAuthenticated) : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (!authReady || redirectTo) {
    return (
      <div className="session-screen" role="status" aria-live="polite">
        <span className="session-spinner" aria-label="Loading" />
      </div>
    );
  }

  return children;
}
