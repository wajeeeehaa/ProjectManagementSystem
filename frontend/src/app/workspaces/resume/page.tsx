'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AuthGuard } from '../../../components/AuthGuard';
import { ApiError, apiRequest } from '../../../lib/api';
import { pickWorkspaceId, readLastWorkspaceId, workspaceHomePath, writeLastWorkspaceId } from '../../../lib/lastWorkspace';
import type { AppDispatch, RootState } from '../../../lib/store';
import { activeWorkspaceChanged, workspacesLoaded, type Workspace } from '../../../lib/workspaceSlice';

function ResumeWorkspace() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    apiRequest<Workspace[]>('/api/workspaces', { redirectOnUnauthorized: true })
      .then((workspaces) => {
        if (!active) return;
        dispatch(workspacesLoaded(workspaces));
        const workspaceId = pickWorkspaceId(workspaces, readLastWorkspaceId(userId));
        if (workspaceId) {
          writeLastWorkspaceId(userId, workspaceId);
          dispatch(activeWorkspaceChanged(workspaceId));
        } else {
          dispatch(activeWorkspaceChanged(null));
        }
        router.replace(workspaceHomePath(workspaceId));
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.statusCode === 401) return;
        router.replace('/workspaces');
      });
    return () => {
      active = false;
    };
  }, [dispatch, router, userId]);

  return (
    <div className="session-screen" role="status" aria-live="polite">
      <span className="session-spinner" aria-label="Opening your workspace" />
    </div>
  );
}

export default function ResumeWorkspacePage() {
  return (
    <AuthGuard mode="private">
      <ResumeWorkspace />
    </AuthGuard>
  );
}
