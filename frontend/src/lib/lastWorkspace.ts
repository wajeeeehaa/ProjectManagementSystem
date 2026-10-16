const storageKey = (userId: string) => `gridly:lastWorkspace:${userId}`;

function storage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function readLastWorkspaceId(userId: string) {
  const value = storage()?.getItem(storageKey(userId));
  return value?.trim() || null;
}

export function writeLastWorkspaceId(userId: string, workspaceId: string) {
  storage()?.setItem(storageKey(userId), workspaceId);
}

export function clearLastWorkspaceId(userId: string) {
  storage()?.removeItem(storageKey(userId));
}

export function forgetLastWorkspaceId(userId: string, workspaceId: string) {
  if (readLastWorkspaceId(userId) === workspaceId) clearLastWorkspaceId(userId);
}

export function pickWorkspaceId(workspaces: { id: string }[], rememberedId: string | null) {
  if (workspaces.length === 0) return null;
  if (rememberedId && workspaces.some((workspace) => workspace.id === rememberedId)) return rememberedId;
  return workspaces[0].id;
}

export function workspaceHomePath(workspaceId: string | null) {
  return workspaceId ? `/workspaces/${workspaceId}` : '/workspaces';
}

const RESERVED_WORKSPACE_IDS = new Set(['resume']);

export function workspaceIdFromPath(pathname: string) {
  const workspaceMatch = pathname.match(/^\/workspaces\/([^/]+)/);
  if (workspaceMatch && !RESERVED_WORKSPACE_IDS.has(workspaceMatch[1])) return workspaceMatch[1];
  const activityMatch = pathname.match(/^\/activity\/([^/]+)/);
  if (activityMatch) return activityMatch[1];
  return null;
}
