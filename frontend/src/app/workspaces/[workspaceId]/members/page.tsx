'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AuthGuard } from '../../../../components/AuthGuard';
import { AppShell } from '../../../../components/AppShell';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { RoleBadge } from '../../../../components/ui/Card';
import { ApiError, apiRequest } from '../../../../lib/api';
import { forgetLastWorkspaceId, writeLastWorkspaceId } from '../../../../lib/lastWorkspace';
import {
  canManageMembers,
  canManageWorkspace,
  canTransferOwnership,
  type WorkspaceRole,
} from '../../../../lib/workspaceRoles';
import type { AppDispatch, RootState } from '../../../../lib/store';
import { activeWorkspaceChanged, workspaceRemoved, workspaceSaved, type Workspace } from '../../../../lib/workspaceSlice';

type Member = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: WorkspaceRole;
  joinedAt: string;
};

type ConfirmRequest =
  | { kind: 'remove'; member: Member }
  | { kind: 'transfer'; member: Member }
  | { kind: 'delete' };

function confirmTitle(request: ConfirmRequest) {
  if (request.kind === 'remove') return 'Remove member';
  if (request.kind === 'delete') return 'Delete workspace';
  return 'Transfer ownership';
}

function confirmMessage(request: ConfirmRequest, workspaceName: string) {
  if (request.kind === 'remove') return `Remove ${request.member.email} from this workspace? This cannot be undone.`;
  if (request.kind === 'delete') return `Delete “${workspaceName}” and every member and project in it? This cannot be undone.`;
  return `Transfer ownership of “${workspaceName}” to ${request.member.email}? You will become an Admin.`;
}

function confirmAction(request: ConfirmRequest) {
  if (request.kind === 'remove') return 'Remove';
  if (request.kind === 'delete') return 'Delete';
  return 'Transfer ownership';
}

function Members() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const workspaceId = params.workspaceId;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<WorkspaceRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<Workspace>(`/api/workspaces/${workspaceId}`, { redirectOnUnauthorized: true }),
      apiRequest<Member[]>(`/api/workspaces/${workspaceId}/members`, { redirectOnUnauthorized: true }),
    ]).then(([loadedWorkspace, loadedMembers]) => {
      if (!active) return;
      setWorkspace(loadedWorkspace);
      dispatch(workspaceSaved(loadedWorkspace));
      dispatch(activeWorkspaceChanged(workspaceId));
      if (userId) writeLastWorkspaceId(userId, workspaceId);
      setMembers(loadedMembers);
    }).catch((caught) => {
      if (!active) return;
      const message = caught instanceof ApiError ? caught.message : 'Unable to load workspace';
      if (caught instanceof ApiError && (caught.statusCode === 403 || caught.statusCode === 404)) {
        if (userId) forgetLastWorkspaceId(userId, workspaceId);
        dispatch(workspaceRemoved(workspaceId));
        router.replace('/workspaces');
        return;
      }
      setError(message);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [dispatch, router, userId, workspaceId]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !email.trim()) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role: newRole }),
      });
      const loaded = await apiRequest<Member[]>(`/api/workspaces/${workspaceId}/members`);
      setMembers(loaded);
      setEmail('');
      setNotice('Member added');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to add member');
    } finally {
      setPending(false);
    }
  }

  async function changeRole(member: Member, role: WorkspaceRole) {
    if (pending || member.role === role) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await apiRequest<{ userId: string; role: WorkspaceRole }>(
        `/api/workspaces/${workspaceId}/members/${member.userId}`,
        { method: 'PATCH', body: JSON.stringify({ role }) },
      );
      setMembers((current) => current.map((item) => item.userId === updated.userId ? { ...item, role: updated.role } : item));
      setNotice('Member role updated');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update role');
    } finally {
      setPending(false);
    }
  }

  async function removeMember(member: Member) {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/workspaces/${workspaceId}/members/${member.userId}`, { method: 'DELETE' });
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
      setNotice('Member removed');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to remove member');
    } finally {
      setPending(false);
    }
  }

  async function deleteWorkspace() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
      if (userId) forgetLastWorkspaceId(userId, workspaceId);
      dispatch(workspaceRemoved(workspaceId));
      router.replace('/workspaces');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete workspace');
      setPending(false);
    }
  }

  async function transferOwnership(member: Member) {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/api/workspaces/${workspaceId}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({ userId: member.userId }),
      });
      setWorkspace((current) => current ? { ...current, role: 'admin' } : current);
      setMembers((current) => current.map((item) => {
        if (item.userId === member.userId) return { ...item, role: 'owner' };
        return item.role === 'owner' ? { ...item, role: 'admin' } : item;
      }));
      setNotice('Ownership transferred');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to transfer ownership');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <AppShell><p className="status-line">Loading members…</p></AppShell>;
  if (!workspace) return <AppShell><p className="status-line" role="alert">{error ?? 'Workspace unavailable.'}</p></AppShell>;
  const manageMembers = canManageMembers(workspace.role);
  const visibleMembers = manageMembers ? members : members.filter((member) => member.role === 'owner' || member.role === 'admin');

  return (
    <AppShell>
      <div className="page-content">
        <header className="page-header">
          <div>
            <h1>Members</h1>
            <p>{manageMembers ? `Manage your team's access to ${workspace.name}.` : `The owner and admins for ${workspace.name}.`}</p>
          </div>
          <RoleBadge role={workspace.role} />
        </header>
        {error ? <p className="form-message error" role="alert">{error}</p> : null}
        {notice ? <p className="form-message success" role="status">{notice}</p> : null}
        {manageMembers ? (
          <section className="ui-card">
            <h2>Add member</h2>
            <form className="member-form" onSubmit={addMember}>
              <input type="email" aria-label="Member email" placeholder="member@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <select aria-label="Member role" value={newRole} onChange={(event) => setNewRole(event.target.value as WorkspaceRole)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" disabled={pending}>Add member</Button>
            </form>
          </section>
        ) : null}
        <section className="ui-card members-card">
          <h2>{manageMembers ? 'Members' : 'Owner and admins'}</h2>
          <div className="member-list">
            {visibleMembers.map((member) => (
              <div className="member-row" key={member.userId}>
                <div><strong>{member.firstName} {member.lastName}</strong>{manageMembers ? <span>{member.email}</span> : null}</div>
                <div className="member-actions">
                  {member.role === 'owner' ? <RoleBadge role="owner" /> : manageMembers ? (
                    <>
                      <select aria-label={`Role for ${member.email}`} value={member.role} disabled={pending} onChange={(event) => changeRole(member, event.target.value as WorkspaceRole)}>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Button variant="ghost" type="button" disabled={pending} onClick={() => setConfirmRequest({ kind: 'remove', member })}>Remove</Button>
                      {canTransferOwnership(workspace.role) ? <Button variant="secondary" type="button" disabled={pending} onClick={() => setConfirmRequest({ kind: 'transfer', member })}>Make owner</Button> : null}
                    </>
                  ) : <RoleBadge role={member.role} />}
                </div>
              </div>
            ))}
          </div>
        </section>
        {canManageWorkspace(workspace.role) ? (
          <section className="ui-card danger-zone">
            <h2>Danger zone</h2>
            <p>Deleting a workspace removes every member and future project data.</p>
            <Button variant="danger" type="button" disabled={pending} onClick={() => setConfirmRequest({ kind: 'delete' })}>Delete workspace</Button>
          </section>
        ) : null}
      </div>
      {confirmRequest ? (
        <ConfirmDialog
          title={confirmTitle(confirmRequest)}
          message={confirmMessage(confirmRequest, workspace.name)}
          confirmLabel={confirmAction(confirmRequest)}
          intent={confirmRequest.kind}
          pending={pending}
          onCancel={() => setConfirmRequest(null)}
          onConfirm={() => {
            const request = confirmRequest;
            setConfirmRequest(null);
            if (request.kind === 'remove') void removeMember(request.member);
            else if (request.kind === 'transfer') void transferOwnership(request.member);
            else void deleteWorkspace();
          }}
        />
      ) : null}
    </AppShell>
  );
}

export default function MembersPage() {
  return <AuthGuard mode="private"><Members /></AuthGuard>;
}
