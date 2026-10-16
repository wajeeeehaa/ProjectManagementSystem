'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AuthGuard } from '../../components/AuthGuard';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/ui/Button';
import { Card, RoleBadge } from '../../components/ui/Card';
import { ApiError, apiRequest } from '../../lib/api';
import { writeLastWorkspaceId } from '../../lib/lastWorkspace';
import type { AppDispatch, RootState } from '../../lib/store';
import { activeWorkspaceChanged, workspaceSaved, workspacesLoaded, type Workspace } from '../../lib/workspaceSlice';
import { roleLabel } from '../../lib/workspaceRoles';

function Workspaces() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [items, setItems] = useState<Workspace[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<Workspace[]>('/api/workspaces', { redirectOnUnauthorized: true })
      .then((workspaces) => {
        if (!active) return;
        setItems(workspaces);
        dispatch(workspacesLoaded(workspaces));
      })
      .catch((caught) => active && setError(caught instanceof ApiError ? caught.message : 'Unable to load workspaces'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [dispatch]);

  function openWorkspace(workspaceId: string) {
    if (!workspaceId) return;
    if (userId) writeLastWorkspaceId(userId, workspaceId);
    dispatch(activeWorkspaceChanged(workspaceId));
    router.push(`/workspaces/${workspaceId}`);
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !name.trim()) return;
    setPending(true);
    setError(null);
    try {
      const workspace = await apiRequest<Workspace>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setItems((current) => [...current, workspace].sort((a, b) => a.name.localeCompare(b.name)));
      dispatch(workspaceSaved(workspace));
      setName('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create workspace');
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell>
      <div className="page-content">
        <header className="page-header">
          <div><h1>Workspaces</h1><p>Create a space for your team and its projects.</p></div>
        </header>
        {items.length > 0 ? (
          <label className="workspace-picker">
            Your workspaces
            <select aria-label="Your workspaces" defaultValue="" onChange={(event) => openWorkspace(event.target.value)}>
              <option value="">Choose a workspace</option>
              {items.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>{workspace.name} · {roleLabel[workspace.role]}</option>
              ))}
            </select>
          </label>
        ) : null}
        <Card className="create-workspace-card">
          <h2>Create workspace</h2>
          <form onSubmit={createWorkspace}>
            <label htmlFor="workspace-name">Workspace name</label>
            <div className="inline-form">
              <input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
              <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create workspace'}</Button>
            </div>
          </form>
        </Card>
        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {loading ? <p className="status-line">Loading workspaces…</p> : null}
        {!loading && items.length === 0 ? <Card className="empty-state"><h2>No workspaces yet</h2><p>Create your first workspace to start collaborating.</p></Card> : null}
        <div className="workspace-grid">
          {items.map((workspace) => (
            <Link className="workspace-card" href={`/workspaces/${workspace.id}`} key={workspace.id}>
              <div><h2>{workspace.name}</h2><p>Open workspace</p></div>
              <RoleBadge role={workspace.role} />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function WorkspacesPage() {
  return <AuthGuard mode="private"><Workspaces /></AuthGuard>;
}
