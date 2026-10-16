'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { AuthGuard } from '../../../components/AuthGuard';
import { Card } from '../../../components/ui/Card';
import { ApiError, apiRequest } from '../../../lib/api';
import type { Project } from '../../../lib/projectTasks';
import type { Workspace } from '../../../lib/workspaceSlice';

function ActivityProjects() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<Workspace>(`/api/workspaces/${workspaceId}`, { redirectOnUnauthorized: true }),
      apiRequest<Project[]>(`/api/workspaces/${workspaceId}/projects`, { redirectOnUnauthorized: true }),
    ]).then(([loadedWorkspace, loadedProjects]) => {
      if (!active) return;
      setWorkspace(loadedWorkspace);
      setProjects(loadedProjects);
    }).catch((caught) => {
      if (!active) return;
      if (caught instanceof ApiError && (caught.statusCode === 403 || caught.statusCode === 404)) {
        router.replace('/activity');
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'Unable to load projects');
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [router, workspaceId]);

  return (
    <AppShell>
      <div className="page-content">
        <Link className="back-link" href="/activity">← Activity</Link>
        {loading ? <p className="status-line">Loading projects…</p> : null}
        {!loading && error ? <p className="status-line" role="alert">{error}</p> : null}
        {!loading && workspace ? (
          <>
            <header className="page-header">
              <div>
                <h1>{workspace.name}</h1>
                <p>Choose a project to see its task activity.</p>
              </div>
            </header>
            {projects.length === 0 ? (
              <Card className="empty-state">
                <h2>No projects yet</h2>
                <p>Activity appears here after this workspace has a project.</p>
              </Card>
            ) : (
              <div className="project-grid">
                {projects.map((project) => (
                  <Link className="project-card" href={`/activity/${workspaceId}/${project.id}`} key={project.id}>
                    <div>
                      <h3>{project.name}</h3>
                      <p>{project.description || 'No description provided.'}</p>
                    </div>
                    <span>View activity</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function ActivityProjectsRoute() {
  return (
    <AuthGuard mode="private">
      <ActivityProjects />
    </AuthGuard>
  );
}
