'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { resolveAuthRedirect } from '../lib/authRedirect';
import type { RootState } from '../lib/store';

export default function HomePage() {
  const router = useRouter();
  const authReady = useSelector((state: RootState) => state.auth.authReady);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  useEffect(() => {
    if (!authReady) return;
    router.replace(resolveAuthRedirect('/', isAuthenticated) ?? '/login');
  }, [authReady, isAuthenticated, router]);

  return <p className="status-line">Loading…</p>;
}
