export type WorkspaceRole = 'owner' | 'admin' | 'member';

export const roleLabel: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export const canManageMembers = (role: WorkspaceRole) => role === 'owner' || role === 'admin';
export const canManageWorkspace = (role: WorkspaceRole) => role === 'owner';
export const canTransferOwnership = (role: WorkspaceRole) => role === 'owner';
export const canManageProjects = (role: WorkspaceRole) => role === 'owner' || role === 'admin';
export const canManageTasks = canManageProjects;
export const canUpdateAssignedTaskStatus = (role: WorkspaceRole) => role === 'member';
