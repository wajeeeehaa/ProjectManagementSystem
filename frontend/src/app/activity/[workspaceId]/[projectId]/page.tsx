'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../components/AppShell';
import { AuthGuard } from '../../../../components/AuthGuard';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import {
  activityAction,
  activityDetail,
  type ActivityFeed,
  type ActivityItem,
  groupActivity,
} from '../../../../lib/activity';
import { ApiError, apiRequest } from '../../../../lib/api';
import type { Project } from '../../../../lib/projectTasks';

const emptyFeed: ActivityFeed = { items: [], nextCursor: null };
const wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim() ?? '';

function belongsToProject(item: ActivityItem, workspaceId: string, projectId: string) {
  return item.workspace.id === workspaceId && item.project.id === projectId;
}

function ActivityTasks() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const projectId = params.projectId;
  const [project, setProject] = useState<Project | null>(null);
  const [feed, setFeed] = useState<ActivityFeed>(emptyFeed);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string | null>(wsUrl ? null : 'Live updates are unavailable');
  const feedRef = useRef(feed);
  feedRef.current = feed;
  const tasks = useMemo(() => groupActivity(feed.items)[0]?.projects[0]?.tasks ?? [], [feed.items]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer = 0;
    let retry = 0;
    let openedBefore = false;
    const matches = (item: ActivityItem) => belongsToProject(item, workspaceId, projectId);

    const takeMatching = (page: ActivityFeed) => ({
      items: page.items.filter(matches),
      nextCursor: page.nextCursor,
    });

    const refetchNewest = async () => {
      try {
        const page = await apiRequest<ActivityFeed>('/api/activity?limit=20', { redirectOnUnauthorized: true });
        if (!active) return;
        const incoming = takeMatching(page);
        setFeed((current) => {
          const seen = new Set(current.items.map((item) => item.id));
          const fresh = incoming.items.filter((item) => !seen.has(item.id));
          return {
            items: [...fresh, ...current.items],
            nextCursor: current.items.length === 0 ? incoming.nextCursor : current.nextCursor,
          };
        });
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to refresh activity');
      }
    };

    const connect = () => {
      if (!active || !wsUrl) return;
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        if (!active) return;
        retry = 0;
        setLiveMessage(null);
        if (openedBefore) void refetchNewest();
        openedBefore = true;
      };
      socket.onmessage = (event) => {
        if (!active) return;
        let message: { type?: string; activity?: ActivityItem; workspaceId?: string };
        try {
          message = JSON.parse(String(event.data)) as { type?: string; activity?: ActivityItem; workspaceId?: string };
        } catch {
          return;
        }
        if (message.type === 'revoked' && message.workspaceId === workspaceId) {
          router.replace('/activity');
          return;
        }
        if (message.type !== 'activity' || !message.activity || !matches(message.activity)) return;
        const activity = message.activity;
        setFeed((current) => {
          if (current.items.some((item) => item.id === activity.id)) return current;
          return { ...current, items: [activity, ...current.items] };
        });
      };
      socket.onclose = () => {
        if (!active) return;
        setLiveMessage('Reconnecting to live updates…');
        const delay = Math.min(10_000, 500 * 2 ** retry);
        retry += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    Promise.all([
      apiRequest<Project>(`/api/workspaces/${workspaceId}/projects/${projectId}`, { redirectOnUnauthorized: true }),
      apiRequest<ActivityFeed>('/api/activity?limit=20', { redirectOnUnauthorized: true }),
    ]).then(([loadedProject, page]) => {
      if (!active) return;
      setProject(loadedProject);
      setFeed(takeMatching(page));
      setError(null);
    }).catch((caught) => {
      if (!active) return;
      if (caught instanceof ApiError && (caught.statusCode === 403 || caught.statusCode === 404)) {
        router.replace(`/activity/${workspaceId}`);
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'Unable to load activity');
    }).finally(() => {
      if (!active) return;
      setLoading(false);
      connect();
    });

    return () => {
      active = false;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [projectId, router, workspaceId]);

  const loadOlder = async () => {
    const cursor = feedRef.current.nextCursor;
    if (!cursor || pending) return;
    setPending(true);
    setError(null);
    try {
      const page = await apiRequest<ActivityFeed>(`/api/activity?limit=20&cursor=${encodeURIComponent(cursor)}`, {
        redirectOnUnauthorized: true,
      });
      setFeed((current) => {
        if (current.nextCursor !== cursor) return current;
        const seen = new Set(current.items.map((item) => item.id));
        const older = page.items.filter((item) => belongsToProject(item, workspaceId, projectId) && !seen.has(item.id));
        return {
          items: [...current.items, ...older],
          nextCursor: page.nextCursor,
        };
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load older activity');
    } finally {
      setPending(false);
    }
  };

  return (
    <AppShell>
      <div className="page-content">
        <Link className="back-link" href={`/activity/${workspaceId}`}>← Projects</Link>
        {loading ? <p className="status-line">Loading activity…</p> : null}
        {!loading && project ? (
          <header className="page-header">
            <div>
              <h1>{project.name}</h1>
              <p>Changes to tasks in this project.</p>
            </div>
          </header>
        ) : null}
        {liveMessage ? <p className={`form-message ${liveMessage === 'Live updates are unavailable' ? 'error' : 'notice'}`} role="status">{liveMessage}</p> : null}
        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {!loading && !error && tasks.length === 0 && !feed.nextCursor ? (
          <Card className="empty-state">
            <h2>No activity yet</h2>
            <p>Task changes in this project will show up here.</p>
          </Card>
        ) : null}
        {!loading && tasks.length === 0 && feed.nextCursor ? (
          <Card className="empty-state">
            <h2>Nothing in the latest updates</h2>
            <p>Older activity may still include this project.</p>
          </Card>
        ) : null}
        {tasks.length ? (
          <div className="activity-task-list">
            {tasks.map((task) => (
              <Card key={task.id}>
                <h2>{task.title}</h2>
                <ul className="activity-events">
                  {task.events.map((event) => {
                    const action = activityAction(event);
                    return (
                      <li className="activity-event" key={event.id}>
                        <p><strong>{action.actor}</strong> {action.verb}</p>
                        <p className="activity-detail">{activityDetail(event)}</p>
                        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        ) : null}
        {!loading && feed.nextCursor ? (
          <div className="pagination activity-older">
            <span>Older activity is available.</span>
            <Button variant="secondary" type="button" disabled={pending} onClick={loadOlder}>
              {pending ? 'Loading…' : 'Load older'}
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function ActivityTasksRoute() {
  return (
    <AuthGuard mode="private">
      <ActivityTasks />
    </AuthGuard>
  );
}
