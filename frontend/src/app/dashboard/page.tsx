'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AuthGuard } from '../../components/AuthGuard';
import { ApiError, apiRequest } from '../../lib/api';
import { signedOut } from '../../lib/authSlice';
import type { AppDispatch, RootState } from '../../lib/store';

function Dashboard() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogout() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', retry: false });
      dispatch(signedOut());
      router.replace('/login');
    } catch (caught) {
      if (caught instanceof ApiError && caught.statusCode === 401) {
        dispatch(signedOut());
        router.replace('/login');
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the server');
      setPending(false);
    }
  }

  if (!user) {
    return <p className="status-line">Loading…</p>;
  }

  return (
    <main className="dashboard">
      <section className="dashboard-card">
        <p className="eyebrow">Signed in</p>
        <h1>Dashboard</h1>
        <dl>
          <dt>Name</dt>
          <dd>{user.firstName} {user.lastName}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>{user.roleTitle}</dd>
        </dl>
        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        <div className="dashboard-actions">
          <Link href="/update-password">Change password</Link>
          <button type="button" onClick={onLogout} disabled={pending}>
            {pending ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard mode="private">
      <Dashboard />
    </AuthGuard>
  );
}
