'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ApiError, apiRequest } from '../lib/api';
import { signedOut } from '../lib/authSlice';
import type { AppDispatch, RootState } from '../lib/store';
import { workspacesCleared } from '../lib/workspaceSlice';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const workspacesActive = pathname === '/workspaces' || pathname.startsWith('/workspaces/');
  const accountActive = pathname === '/dashboard' || pathname.startsWith('/update-password');
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', retry: false });
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) {
        setPending(false);
        return;
      }
    }
    dispatch(workspacesCleared());
    dispatch(signedOut());
    router.replace('/login');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="brand" href="/workspaces"><span>G</span> Gridly</Link>
        <nav aria-label="Main navigation">
          <Link className={`sidebar-link${workspacesActive ? ' sidebar-link-active' : ''}`} href="/workspaces" aria-current={workspacesActive ? 'page' : undefined}>Workspaces</Link>
          <Link className={`sidebar-link${accountActive ? ' sidebar-link-active' : ''}`} href="/dashboard" aria-current={accountActive ? 'page' : undefined}>Account</Link>
        </nav>
        <div className="sidebar-user">
          <strong>{user?.firstName} {user?.lastName}</strong>
          <small>{user?.email}</small>
          <button className="sidebar-link sidebar-logout" type="button" disabled={pending} onClick={logout}>
            {pending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
