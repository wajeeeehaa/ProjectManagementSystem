import type { ReactNode } from 'react';
import { roleLabel, type WorkspaceRole } from '../../lib/workspaceRoles';

const roleHint: Record<WorkspaceRole, string> = {
  owner: 'Owner: full control of this workspace',
  admin: 'Admin: manages members, projects, and tasks',
  member: 'Member: views work and updates assigned tasks',
};

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`ui-card ${className}`}>{children}</section>;
}

export function RoleBadge({ role }: { role: string }) {
  const known = role in roleLabel;
  const label = known ? roleLabel[role as WorkspaceRole] : role;
  const hint = known ? roleHint[role as WorkspaceRole] : label;
  return <span className={`role-badge role-badge-${role}`} title={hint}>{label}</span>;
}
