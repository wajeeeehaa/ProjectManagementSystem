'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '../../lib/store';
import { getAccessToken } from '../../lib/token';

export default function DashboardPage() {
  const router = useRouter();
  const authReady = useSelector((state: RootState) => state.auth.authReady);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    const current = getAccessToken();
    if (!current) {
      router.replace('/login');
      return;
    }
    setToken(current);
  }, [authReady, router]);

  if (!token) {
    return null;
  }

  return (
    <main>
      <h1>Dashboard</h1>
    </main>
  );
}
