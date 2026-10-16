'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ApiError, apiRequest } from '../lib/api';
import { signedOut } from '../lib/authSlice';
import { workspaceIdFromPath, writeLastWorkspaceId, clearLastWorkspaceId } from '../lib/lastWorkspace';
import { profileDisplayName, profileInitials } from '../lib/profileLabel';
import type { AppDispatch, RootState } from '../lib/store';
import { activeWorkspaceChanged, workspacesCleared, workspacesLoaded, type Workspace } from '../lib/workspaceSlice';
import { roleLabel } from '../lib/workspaceRoles';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className="profile-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={open ? 'M6 14.5 12 8.5l6 6' : 'M6 9.5 12 15.5l6-6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const workspaces = useSelector((state: RootState) => state.workspaces.items);
  const workspacesActive = pathname === '/workspaces' || pathname.startsWith('/workspaces/');
  const activityActive = pathname === '/activity' || pathname.startsWith('/activity/');
  const accountActive = pathname === '/dashboard' || pathname.startsWith('/update-password');
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = profileDisplayName(user);
  const initials = profileInitials(user);
  const openWorkspaceId = workspaceIdFromPath(pathname);
  const openWorkspace = workspaces.find((workspace) => workspace.id === openWorkspaceId) ?? null;
  const workspaceLine = openWorkspace?.name ?? 'No workspace';

  useEffect(() => {
    if (!user) return;
    let active = true;
    apiRequest<Workspace[]>('/api/workspaces', { redirectOnUnauthorized: true })
      .then((items) => {
        if (active) dispatch(workspacesLoaded(items));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [dispatch, user]);

  useEffect(() => {
    if (!user || !openWorkspace) return;
    writeLastWorkspaceId(user.id, openWorkspace.id);
    dispatch(activeWorkspaceChanged(openWorkspace.id));
  }, [dispatch, openWorkspace, user]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  function selectWorkspace(workspaceId: string) {
    if (user) writeLastWorkspaceId(user.id, workspaceId);
    dispatch(activeWorkspaceChanged(workspaceId));
    setMenuOpen(false);
    router.push(`/workspaces/${workspaceId}`);
  }

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
    if (user) clearLastWorkspaceId(user.id);
    dispatch(workspacesCleared());
    dispatch(signedOut());
    router.replace('/login');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-profile-slot" ref={menuRef}>
          <button
            className="sidebar-profile"
            type="button"
            aria-label={`${displayName}, ${workspaceLine}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="profile-avatar" aria-hidden="true">{initials}</span>
            <span className="sidebar-profile-copy">
              <span className="profile-name">{displayName}</span>
              <small>{workspaceLine}</small>
            </span>
            <Chevron open={menuOpen} />
          </button>
          {menuOpen ? (
            <div className="profile-dropdown" role="menu" aria-label="Account menu">
              <div className="profile-workspaces" role="group" aria-label="Workspaces">
                {workspaces.length === 0 ? <p>No workspaces yet</p> : workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    role="menuitemradio"
                    type="button"
                    aria-checked={workspace.id === openWorkspaceId}
                    className={workspace.id === openWorkspaceId ? 'profile-workspace-current' : undefined}
                    onClick={() => selectWorkspace(workspace.id)}
                  >
                    <span>{workspace.name}</span>
                    <small>{roleLabel[workspace.role]}</small>
                  </button>
                ))}
              </div>
              <Link role="menuitem" href="/workspaces" onClick={() => setMenuOpen(false)}>Manage workspaces</Link>
              <Link role="menuitem" href="/update-password" onClick={() => setMenuOpen(false)}>Change password</Link>
              <button role="menuitem" type="button" disabled={pending} onClick={() => { setMenuOpen(false); void logout(); }}>
                {pending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ) : null}
        </div>
        <nav aria-label="Main navigation">
          <Link className={`sidebar-link${workspacesActive ? ' sidebar-link-active' : ''}`} href="/workspaces" aria-current={workspacesActive ? 'page' : undefined}>Workspaces</Link>
          <Link className={`sidebar-link${activityActive ? ' sidebar-link-active' : ''}`} href="/activity" aria-current={activityActive ? 'page' : undefined}>Activity</Link>
          <Link className={`sidebar-link${accountActive ? ' sidebar-link-active' : ''}`} href="/dashboard" aria-current={accountActive ? 'page' : undefined}>Account</Link>
        </nav>
        <button className="sidebar-logout" type="button" disabled={pending} onClick={() => void logout()}>
          <LogOut size={18} strokeWidth={2.25} aria-hidden="true" />
          {pending ? 'Signing out…' : 'Log out'}
        </button>
      </aside>
      <div className="app-column">
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
