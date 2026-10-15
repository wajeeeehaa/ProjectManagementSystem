import { describe, expect, it } from 'vitest';
import { canManageMembers, canManageWorkspace, canTransferOwnership } from './workspaceRoles';

describe('workspace role permissions', () => {
  it('keeps workspace settings and ownership transfer owner-only', () => {
    expect(canManageWorkspace('owner')).toBe(true);
    expect(canTransferOwnership('owner')).toBe(true);
    expect(canManageWorkspace('admin')).toBe(false);
    expect(canTransferOwnership('member')).toBe(false);
  });

  it('allows Owners and Admins to manage non-owner members', () => {
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('member')).toBe(false);
  });
});
