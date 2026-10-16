'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AuthGuard } from '../../../../components/AuthGuard';
import { AppShell } from '../../../../components/AppShell';
import { Button } from '../../../../components/ui/Button';
import { RoleBadge } from '../../../../components/ui/Card';
import { ApiError, apiRequest } from '../../../../lib/api';
import { forgetLastWorkspaceId, writeLastWorkspaceId } from '../../../../lib/lastWorkspace';
import { type Project, projectPath } from '../../../../lib/projectTasks';
import { canManageProjects } from '../../../../lib/workspaceRoles';
import type { AppDispatch, RootState } from '../../../../lib/store';
import { activeWorkspaceChanged, workspaceRemoved, workspaceSaved, type Workspace } from '../../../../lib/workspaceSlice';

function Projects() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const workspaceId = params.workspaceId;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<Workspace>(`/api/workspaces/${workspaceId}`, { redirectOnUnauthorized: true })
      .then(async (loadedWorkspace) => {
        if (!active) return;
        setWorkspace(loadedWorkspace);
        dispatch(workspaceSaved(loadedWorkspace));
        dispatch(activeWorkspaceChanged(workspaceId));
        if (userId) writeLastWorkspaceId(userId, workspaceId);
        try {
          const loadedProjects = await apiRequest<Project[]>(`/api/workspaces/${workspaceId}/projects?assigned=true`);
          if (active) setProjects(loadedProjects);
        } catch (caught) {
          if (!active) return;
          setError(caught instanceof ApiError ? caught.message : 'Unable to load projects');
        }
      })
      .catch((caught) => {
        if (!active) return;
        const message = caught instanceof ApiError ? caught.message : 'Unable to load workspace';
        if (caught instanceof ApiError && (caught.statusCode === 403 || caught.statusCode === 404)) {
          if (userId) forgetLastWorkspaceId(userId, workspaceId);
          dispatch(workspaceRemoved(workspaceId));
          router.replace('/workspaces');
          return;
        }
        setError(message);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [dispatch, router, userId, workspaceId]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !projectName.trim()) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const project = await apiRequest<Project>(`/api/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: projectName }),
      });
      setProjects((current) => [project, ...current]);
      setProjectName('');
      setNotice('Project created');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create project');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <AppShell><p className="status-line">Loading projects…</p></AppShell>;
  if (!workspace) return <AppShell><p className="status-line" role="alert">{error ?? 'Workspace unavailable.'}</p></AppShell>;
  const manageProjects = canManageProjects(workspace.role);

  return (
    <AppShell>
      <div className="page-content">
        <header className="page-header">
          <div><h1>Projects</h1><p>{manageProjects ? `Create projects and track the team's work in ${workspace.name}.` : `Projects you are working on in ${workspace.name}.`}</p></div>
          <RoleBadge role={workspace.role} />
        </header>
        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {notice ? <p className="form-message success" role="status">{notice}</p> : null}
        <section className="ui-card">
          {manageProjects ? (
            <form className="inline-form" onSubmit={createProject}>
              <input aria-label="Project name" placeholder="New project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={160} required />
              <Button type="submit" disabled={pending}>Create project</Button>
            </form>
          ) : null}
          {projects.length === 0 ? (
            <div className="empty-state compact">
              <h3>No projects yet</h3>
              <p>{manageProjects ? 'Create the first project to start organizing work.' : 'Projects appear here when you are assigned to a task.'}</p>
            </div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <Link className="project-card" href={projectPath(workspaceId, project.id)} key={project.id}>
                  <div><h3>{project.name}</h3><p>{project.description || 'No description provided.'}</p></div>
                  <span>View project →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default function ProjectsPage() {
  return <AuthGuard mode="private"><Projects /></AuthGuard>;
}
