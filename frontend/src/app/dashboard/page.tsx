'use client';

import Link from 'next/link';
import { useSelector } from 'react-redux';
import { AppShell } from '../../components/AppShell';
import { AuthGuard } from '../../components/AuthGuard';
import { Card } from '../../components/ui/Card';
import type { RootState } from '../../lib/store';

function Account() {
  const user = useSelector((state: RootState) => state.auth.user);

  if (!user) {
    return (
      <AppShell>
        <p className="status-line">Loading account…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content">
        <header className="page-header">
          <div>
            <h1>Account</h1>
            <p>View your profile and update your password.</p>
          </div>
        </header>
        <Card>
          <h2>Profile</h2>
          <dl className="account-details">
            <dt>Name</dt>
            <dd>{user.firstName} {user.lastName}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </dl>
          <Link className="ui-button" href="/update-password">Change password</Link>
        </Card>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard mode="private">
      <Account />
    </AuthGuard>
  );
}
