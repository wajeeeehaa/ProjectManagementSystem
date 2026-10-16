'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AuthGuard } from '../../../components/AuthGuard';
import { writeLastWorkspaceId } from '../../../lib/lastWorkspace';
import type { AppDispatch, RootState } from '../../../lib/store';
import { activeWorkspaceChanged } from '../../../lib/workspaceSlice';

function OpenWorkspace() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const workspaceId = params.workspaceId;

  useEffect(() => {
    if (userId) writeLastWorkspaceId(userId, workspaceId);
    dispatch(activeWorkspaceChanged(workspaceId));
    router.replace('/workspaces');
  }, [dispatch, router, userId, workspaceId]);

  return <p className="status-line">Opening workspace…</p>;
}

export default function WorkspacePage() {
  return <AuthGuard mode="private"><OpenWorkspace /></AuthGuard>;
}
