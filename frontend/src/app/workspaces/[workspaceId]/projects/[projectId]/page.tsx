'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { AppShell } from '../../../../../components/AppShell';
import { AuthGuard } from '../../../../../components/AuthGuard';
import { Button } from '../../../../../components/ui/Button';
import { Card } from '../../../../../components/ui/Card';
import { ApiError, apiRequest } from '../../../../../lib/api';
import {
  canEditTask,
  priorityLabel,
  type ProjectDetail,
  projectPath,
  type Task,
  type TaskList,
  type TaskPriority,
  taskQueryString,
  type TaskStatus,
  statusLabel,
} from '../../../../../lib/projectTasks';
import type { RootState } from '../../../../../lib/store';
import {
  canManageProjects,
  canManageTasks,
  type WorkspaceRole,
} from '../../../../../lib/workspaceRoles';
import type { Workspace } from '../../../../../lib/workspaceSlice';

type Member = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: WorkspaceRole;
};

function assigneeChoices(
  members: Member[],
  current?: { userId: string; firstName: string; lastName: string },
) {
  const choices = members
    .filter((member) => member.role === 'member')
    .map((member) => ({
      userId: member.userId,
      label: `${member.firstName} ${member.lastName}`,
    }));
  if (current && !choices.some((choice) => choice.userId === current.userId)) {
    choices.unshift({
      userId: current.userId,
      label: `${current.firstName} ${current.lastName} (current assignee)`,
    });
  }
  return choices;
}

const emptyTask = {
  title: '',
  description: '',
  status: 'TODO' as TaskStatus,
  priority: 'MEDIUM' as TaskPriority,
  assigneeId: '',
  dueDate: '',
};

function ProjectDetailPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useSelector((state: RootState) => state.auth.user);
  const workspaceId = params.workspaceId;
  const projectId = params.projectId;
  const basePath = projectPath(workspaceId, projectId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [taskList, setTaskList] = useState<TaskList | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | 'project' | null>(null);
  const [projectDraft, setProjectDraft] = useState({ name: '', description: '' });
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = useMemo(() => ({
    search: searchParams.get('search') || undefined,
    status: (searchParams.get('status') as TaskStatus | null) || undefined,
    priority: (searchParams.get('priority') as TaskPriority | null) || undefined,
    assigneeId: searchParams.get('assigneeId') || undefined,
    sortBy: (searchParams.get('sortBy') as 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title' | null) || 'createdAt',
    sortDirection: (searchParams.get('sortDirection') as 'asc' | 'desc' | null) || 'desc',
    page: Number(searchParams.get('page') || '1'),
    pageSize: 20,
  }), [searchParams]);
  const queryString = taskQueryString(query);

  const replaceQuery = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${basePath}${next.size ? `?${next.toString()}` : ''}`);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<Workspace>(`/api/workspaces/${workspaceId}`, { redirectOnUnauthorized: true }),
      apiRequest<ProjectDetail>(`/api/workspaces/${workspaceId}/projects/${projectId}`, { redirectOnUnauthorized: true }),
      apiRequest<Member[]>(`/api/workspaces/${workspaceId}/members`, { redirectOnUnauthorized: true }),
      apiRequest<TaskList>(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks?${queryString}`, { redirectOnUnauthorized: true }),
    ]).then(([loadedWorkspace, loadedProject, loadedMembers, loadedTasks]) => {
      if (!active) return;
      setWorkspace(loadedWorkspace);
      setProject(loadedProject);
      setMembers(loadedMembers);
      setTaskList(loadedTasks);
    }).catch((caught) => {
      if (!active) return;
      const message = caught instanceof ApiError ? caught.message : 'Unable to load project';
      if (caught instanceof ApiError && (caught.statusCode === 403 || caught.statusCode === 404)) {
        router.replace(`/workspaces/${workspaceId}`);
        return;
      }
      setError(message);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [projectId, queryString, router, workspaceId]);

  useEffect(() => {
    const currentSearch = searchParams.get('search') ?? '';
    if (searchInput === currentSearch) return;
    const timer = window.setTimeout(() => replaceQuery({ search: searchInput || undefined, page: undefined }), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchParams]);

  const reloadProject = async () => {
    const loaded = await apiRequest<ProjectDetail>(`/api/workspaces/${workspaceId}/projects/${projectId}`);
    setProject(loaded);
  };

  const reloadTasks = async () => {
    const loaded = await apiRequest<TaskList>(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks?${queryString}`);
    setTaskList(loaded);
  };

  const saveProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(null); setNotice(null);
    try {
      await apiRequest(basePath, {
        method: 'PATCH',
        body: JSON.stringify({ name: projectDraft.name, description: projectDraft.description || null }),
      });
      await reloadProject();
      setEditingProject(false);
      setNotice('Project updated');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update project');
    } finally { setPending(false); }
  };

  const deleteProject = async () => {
    if (pending) return;
    setPending(true); setError(null);
    try {
      await apiRequest(basePath, { method: 'DELETE' });
      router.replace(`/workspaces/${workspaceId}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete project');
      setPending(false);
    }
  };

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(null); setNotice(null);
    try {
      await apiRequest(`${basePath}/tasks`, { method: 'POST', body: JSON.stringify(taskForm) });
      setTaskForm(emptyTask);
      replaceQuery({ page: '1' });
      await reloadTasks();
      await reloadProject();
      setNotice('Task created');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create task');
    } finally { setPending(false); }
  };

  const updateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTask || pending) return;
    setPending(true); setError(null); setNotice(null);
    const payload = selectedTask.assigneeId === user?.id && workspace?.role === 'member'
      ? { status: selectedTask.status, version: selectedTask.version }
      : {
          title: selectedTask.title,
          description: selectedTask.description,
          status: selectedTask.status,
          priority: selectedTask.priority,
          assigneeId: selectedTask.assigneeId,
          dueDate: selectedTask.dueDate,
          version: selectedTask.version,
        };
    try {
      await apiRequest(`${basePath}/tasks/${selectedTask.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setSelectedTask(null);
      await reloadTasks();
      await reloadProject();
      setNotice('Task updated');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update task');
    } finally { setPending(false); }
  };

  const deleteTask = async (task: Task) => {
    if (pending) return;
    setPending(true); setError(null); setNotice(null);
    try {
      await apiRequest(`${basePath}/tasks/${task.id}`, { method: 'DELETE' });
      await reloadTasks();
      await reloadProject();
      setNotice('Task deleted');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete task');
    } finally { setPending(false); }
  };

  if (loading) return <AppShell><p className="status-line">Loading project…</p></AppShell>;
  if (!workspace || !project) return <AppShell><p className="status-line" role="alert">{error ?? 'Project unavailable.'}</p></AppShell>;

  const manageTasks = canManageTasks(workspace.role);
  const canManageProject = canManageProjects(workspace.role);
  const activeRole = workspace.role;
  const createAssignees = assigneeChoices(members);
  const editAssignees = selectedTask
    ? assigneeChoices(members, {
        userId: selectedTask.assigneeId,
        firstName: selectedTask.assignee.firstName,
        lastName: selectedTask.assignee.lastName,
      })
    : [];

  return <AppShell>
    <div className="page-content">
      <Link className="back-link" href={`/workspaces/${workspaceId}`}>← {workspace.name}</Link>
      <header className="page-header">
        <div><h1>{project.name}</h1><p>{project.description || 'Plan, assign, and track the work in this project.'}</p></div>
        {canManageProject ? <div className="header-actions"><Button variant="secondary" type="button" onClick={() => { setProjectDraft({ name: project.name, description: project.description ?? '' }); setEditingProject(true); }}>Edit project</Button><Button variant="danger" type="button" onClick={() => setDeleteTarget('project')}>Delete project</Button></div> : null}
      </header>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      {notice ? <p className="form-message success" role="status">{notice}</p> : null}
      <section className="stats-grid" aria-label="Project statistics">
        <Card><span>Total tasks</span><strong>{project.statistics.total}</strong></Card>
        <Card><span>To do</span><strong>{project.statistics.todo}</strong></Card>
        <Card><span>In progress</span><strong>{project.statistics.inProgress}</strong></Card>
        <Card><span>Done</span><strong>{project.statistics.done}</strong></Card>
      </section>
      {manageTasks ? <Card><h2>Create task</h2><form className="task-form" onSubmit={submitTask}>
        <label>Title<input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} maxLength={240} required /></label>
        <label>Assignee<select value={taskForm.assigneeId} onChange={(event) => setTaskForm({ ...taskForm, assigneeId: event.target.value })} required><option value="">Select a member</option>{createAssignees.map((assignee) => <option key={assignee.userId} value={assignee.userId}>{assignee.label}</option>)}</select></label>
        <label>Due date<input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} required /></label>
        <label>Status<select value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value as TaskStatus })}>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Priority<select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as TaskPriority })}>{Object.entries(priorityLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="form-span">Description<textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} maxLength={10000} /></label>
        <div className="form-span"><Button type="submit" disabled={pending}>Create task</Button></div>
      </form></Card> : null}
      <Card className="task-list-card">
        <div className="card-heading"><div><h2>Tasks</h2><p>{taskList?.pagination.total ?? 0} tasks in this project</p></div></div>
        <div className="task-filters">
          <input aria-label="Search tasks" placeholder="Search tasks" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <select aria-label="Filter by status" value={query.status ?? ''} onChange={(event) => replaceQuery({ status: event.target.value || undefined, page: undefined })}><option value="">All statuses</option>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          <select aria-label="Filter by priority" value={query.priority ?? ''} onChange={(event) => replaceQuery({ priority: event.target.value || undefined, page: undefined })}><option value="">All priorities</option>{Object.entries(priorityLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          <select aria-label="Filter by assignee" value={query.assigneeId ?? ''} onChange={(event) => replaceQuery({ assigneeId: event.target.value || undefined, page: undefined })}><option value="">All assignees</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.firstName} {member.lastName}</option>)}</select>
          <select aria-label="Sort tasks" value={`${query.sortBy}:${query.sortDirection}`} onChange={(event) => { const [sortBy, sortDirection] = event.target.value.split(':'); replaceQuery({ sortBy, sortDirection, page: undefined }); }}><option value="createdAt:desc">Newest first</option><option value="updatedAt:desc">Recently updated</option><option value="dueDate:asc">Due date</option><option value="priority:desc">Priority</option><option value="title:asc">Title</option></select>
        </div>
        {!taskList?.items.length ? <div className="empty-state compact"><h3>No matching tasks</h3><p>Try changing your filters or create a new task.</p></div> : <div className="task-table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th><th aria-label="Actions" /></tr></thead><tbody>{taskList.items.map((task) => <tr key={task.id}><td><strong>{task.title}</strong><small>{task.description || 'No description'}</small></td><td><span className={`status-chip status-${task.status}`}>{statusLabel[task.status]}</span></td><td><span className={`priority-chip priority-${task.priority}`}>{priorityLabel[task.priority]}</span></td><td>{task.assignee.firstName} {task.assignee.lastName}</td><td>{new Date(task.dueDate).toLocaleDateString()}</td><td className="task-actions">{canEditTask(activeRole, task, user?.id) ? <Button variant="secondary" type="button" onClick={() => setSelectedTask(task)}>Edit</Button> : null}{manageTasks ? <Button variant="ghost" type="button" onClick={() => setDeleteTarget(task)}>Delete</Button> : null}</td></tr>)}</tbody></table></div>}
        {taskList && taskList.pagination.totalPages > 1 ? <div className="pagination"><span>Page {taskList.pagination.page} of {taskList.pagination.totalPages}</span><div><Button variant="secondary" type="button" disabled={taskList.pagination.page === 1} onClick={() => replaceQuery({ page: String(taskList.pagination.page - 1) })}>Previous</Button><Button variant="secondary" type="button" disabled={taskList.pagination.page === taskList.pagination.totalPages} onClick={() => replaceQuery({ page: String(taskList.pagination.page + 1) })}>Next</Button></div></div> : null}
      </Card>
      {selectedTask ? <div className="modal-overlay" role="presentation"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="task-edit-title"><header><h2 id="task-edit-title">Edit task</h2><Button variant="secondary" type="button" onClick={() => setSelectedTask(null)}>Close</Button></header><form className="task-form" onSubmit={updateTask}>
        {activeRole !== 'member' ? <><label>Title<input value={selectedTask.title} onChange={(event) => setSelectedTask({ ...selectedTask, title: event.target.value })} required /></label><label>Assignee<select value={selectedTask.assigneeId} onChange={(event) => setSelectedTask({ ...selectedTask, assigneeId: event.target.value })}>{editAssignees.map((assignee) => <option key={assignee.userId} value={assignee.userId}>{assignee.label}</option>)}</select></label><label>Due date<input type="date" value={selectedTask.dueDate.slice(0, 10)} onChange={(event) => setSelectedTask({ ...selectedTask, dueDate: event.target.value })} required /></label><label>Priority<select value={selectedTask.priority} onChange={(event) => setSelectedTask({ ...selectedTask, priority: event.target.value as TaskPriority })}>{Object.entries(priorityLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="form-span">Description<textarea value={selectedTask.description ?? ''} onChange={(event) => setSelectedTask({ ...selectedTask, description: event.target.value })} /></label></> : null}
        <label>Status<select value={selectedTask.status} onChange={(event) => setSelectedTask({ ...selectedTask, status: event.target.value as TaskStatus })}>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><footer className="form-span"><Button variant="secondary" type="button" onClick={() => setSelectedTask(null)}>Cancel</Button><Button type="submit" disabled={pending}>Save changes</Button></footer>
      </form></section></div> : null}
      {editingProject ? <div className="modal-overlay" role="presentation"><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="project-edit-title"><header><h2 id="project-edit-title">Edit project</h2><Button variant="secondary" type="button" onClick={() => setEditingProject(false)}>Close</Button></header><form className="task-form" onSubmit={saveProject}><label className="form-span">Name<input value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} maxLength={160} required /></label><label className="form-span">Description<textarea value={projectDraft.description} onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })} maxLength={10000} /></label><footer className="form-span"><Button variant="secondary" type="button" onClick={() => setEditingProject(false)}>Cancel</Button><Button type="submit" disabled={pending}>Save changes</Button></footer></form></section></div> : null}
      {deleteTarget ? <div className="modal-overlay" role="presentation"><section className="modal-panel confirm-panel" role="dialog" aria-modal="true" aria-labelledby="delete-title"><header><h2 id="delete-title">Confirm deletion</h2></header><p>{deleteTarget === 'project' ? `Delete “${project.name}” and every task in it? This cannot be undone.` : `Delete “${deleteTarget.title}”? This cannot be undone.`}</p><footer><Button variant="secondary" type="button" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" type="button" disabled={pending} onClick={() => { setDeleteTarget(null); if (deleteTarget === 'project') void deleteProject(); else void deleteTask(deleteTarget); }}>Delete</Button></footer></section></div> : null}
    </div>
  </AppShell>;
}

export default function ProjectPage() {
  return <AuthGuard mode="private"><ProjectDetailPage /></AuthGuard>;
}
