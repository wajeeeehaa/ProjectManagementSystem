'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AuthGuard } from '../../components/AuthGuard';
import { Card, RoleBadge } from '../../components/ui/Card';
import { ApiError, apiRequest } from '../../lib/api';
import type { Workspace } from '../../lib/workspaceSlice';

function ActivityWorkspaces() {
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<Workspace[]>('/api/workspaces', { redirectOnUnauthorized: true })
      .then((workspaces) => {
        if (!active) return;
        setItems(workspaces);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to load workspaces');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <AppShell>
      <div className="page-content">
        <header className="page-header">
          <div>
            <h1>Activity</h1>
            <p>Choose a workspace to see its project activity.</p>
          </div>
        </header>
        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {loading ? <p className="status-line">Loading workspaces…</p> : null}
        {!loading && !error && items.length === 0 ? (
          <Card className="empty-state">
            <h2>No workspaces yet</h2>
            <p>Create a workspace before activity can appear here.</p>
          </Card>
        ) : null}
        <div className="workspace-grid">
          {items.map((workspace) => (
            <Link className="workspace-card" href={`/activity/${workspace.id}`} key={workspace.id}>
              <div>
                <h2>{workspace.name}</h2>
                <p>View activity</p>
              </div>
              <RoleBadge role={workspace.role} />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function ActivityRoute() {
  return (
    <AuthGuard mode="private">
      <ActivityWorkspaces />
    </AuthGuard>
  );
}
