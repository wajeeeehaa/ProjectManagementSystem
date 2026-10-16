'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AuthGuard } from '../../components/AuthGuard';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/ui/Button';
import { Card, RoleBadge } from '../../components/ui/Card';
import { ApiError, apiRequest } from '../../lib/api';
import { pickWorkspaceId, readLastWorkspaceId, writeLastWorkspaceId } from '../../lib/lastWorkspace';
import { type Project, projectPath } from '../../lib/projectTasks';
import type { AppDispatch, RootState } from '../../lib/store';
import { activeWorkspaceChanged, workspaceSaved, workspacesLoaded, type Workspace } from '../../lib/workspaceSlice';
import { roleLabel } from '../../lib/workspaceRoles';

function Workspaces() {
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const activeWorkspaceId = useSelector((state: RootState) => state.workspaces.activeWorkspaceId);
  const [items, setItems] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const selected = items.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

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

  useEffect(() => {
    if (!userId || loading || items.length === 0 || selected) return;
    const picked = pickWorkspaceId(items, readLastWorkspaceId(userId));
    if (!picked) return;
    writeLastWorkspaceId(userId, picked);
    dispatch(activeWorkspaceChanged(picked));
  }, [dispatch, items, loading, selected, userId]);

  useEffect(() => {
    if (!selected) {
      setProjects([]);
      return;
    }
    let active = true;
    setProjectsLoading(true);
    setError(null);
    apiRequest<Project[]>(`/api/workspaces/${selected.id}/projects`)
      .then((loaded) => {
        if (active) setProjects(loaded);
      })
      .catch((caught) => {
        if (!active) return;
        setProjects([]);
        setError(caught instanceof ApiError ? caught.message : 'Unable to load projects');
      })
      .finally(() => active && setProjectsLoading(false));
    return () => { active = false; };
  }, [selected]);

  function openWorkspace(workspaceId: string) {
    if (!workspaceId) return;
    if (userId) writeLastWorkspaceId(userId, workspaceId);
    dispatch(activeWorkspaceChanged(workspaceId));
  }

  function openCreate() {
    setName('');
    setFormError(null);
    setCreating(true);
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !name.trim()) return;
    setPending(true);
    setFormError(null);
    try {
      const workspace = await apiRequest<Workspace>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setItems((current) => [...current, workspace].sort((a, b) => a.name.localeCompare(b.name)));
      dispatch(workspaceSaved(workspace));
      openWorkspace(workspace.id);
      setName('');
      setCreating(false);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Unable to create workspace');
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell>
      <div className="page-content">
        <header className="page-header">
          <div>
            <h1>{selected?.name ?? 'Workspaces'}</h1>
            <p>{selected ? 'Projects in this workspace.' : 'Create a space for your team and its projects.'}</p>
            {items.length > 0 ? (
              <label className="workspace-picker">
                Workspace
                <select aria-label="Workspace" value={selected?.id ?? ''} onChange={(event) => openWorkspace(event.target.value)}>
                  {items.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name} · {roleLabel[workspace.role]}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="header-actions">
            <Button type="button" onClick={openCreate}>Create workspace</Button>
            {selected ? <RoleBadge role={selected.role} /> : null}
          </div>
        </header>
        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {loading || projectsLoading ? <p className="status-line">Loading…</p> : null}
        {selected && !loading && !projectsLoading && !error && projects.length === 0 ? (
          <Card className="empty-state"><h2>No projects yet</h2><p>Projects in this workspace show up here.</p></Card>
        ) : null}
        {selected && projects.length > 0 ? (
          <div className="project-grid">
            {projects.map((project) => (
              <Link className="project-card" href={projectPath(selected.id, project.id)} key={project.id}>
                <div><h3>{project.name}</h3><p>{project.description || 'No description provided.'}</p></div>
                <span>View project →</span>
              </Link>
            ))}
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <Card className="empty-state">
            <h2>No workspaces yet</h2>
            <p>Create your first workspace to start collaborating.</p>
            <Button type="button" onClick={openCreate}>Create workspace</Button>
          </Card>
        ) : null}
      </div>
      {creating ? (
        <div className="modal-overlay" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-workspace-title">
            <header>
              <h2 id="create-workspace-title">Create workspace</h2>
              <Button variant="secondary" type="button" onClick={() => setCreating(false)}>Close</Button>
            </header>
            <form onSubmit={createWorkspace}>
              <label htmlFor="workspace-name">Workspace name</label>
              <input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
              {formError ? <p className="form-message error" role="alert">{formError}</p> : null}
              <footer>
                <Button variant="secondary" type="button" onClick={() => setCreating(false)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create workspace'}</Button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function WorkspacesPage() {
  return <AuthGuard mode="private"><Workspaces /></AuthGuard>;
}
