import { describe, expect, it } from 'vitest';
import { taskQueryString } from './projectTasks';
import { canManageProjects, canUpdateAssignedTaskStatus } from './workspaceRoles';

describe('project and task helpers', () => {
  it('serializes only active task-list query values', () => {
    expect(taskQueryString({
      search: 'launch',
      status: 'TODO',
      page: 2,
      sortBy: 'dueDate',
      sortDirection: 'asc',
    })).toBe('search=launch&status=TODO&page=2&sortBy=dueDate&sortDirection=asc');
  });

  it('keeps management actions limited to Owner and Admin', () => {
    expect(canManageProjects('owner')).toBe(true);
    expect(canManageProjects('admin')).toBe(true);
    expect(canManageProjects('member')).toBe(false);
    expect(canUpdateAssignedTaskStatus('member')).toBe(true);
  });
});
