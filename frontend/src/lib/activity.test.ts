import { describe, expect, it } from 'vitest';
import { activityAction, activityDetail, groupActivity, mergeNewest, type ActivityItem } from './activity';

const item = (overrides: Partial<ActivityItem>): ActivityItem => ({
  id: '1',
  eventType: 'TASK_CREATED',
  createdAt: '2026-10-15T12:00:00.000Z',
  actor: { id: 'actor', firstName: 'Ada', lastName: 'Lovelace' },
  workspace: { id: 'workspace', name: 'Delivery' },
  project: { id: 'project', name: 'Launch' },
  task: { id: 'task', title: 'Prepare notes' },
  details: {
    status: 'TODO',
    priority: 'HIGH',
    assignees: [{ id: 'member', firstName: 'Grace', lastName: 'Hopper' }],
  },
  ...overrides,
});

describe('activity text', () => {
  it('describes creation, changes, and deletion', () => {
    expect(activityAction(item({})).verb).toBe('created this task');
    expect(activityDetail(item({}))).toBe('Status To do. Priority High. Assigned to Grace Hopper.');
    expect(activityDetail(item({
      eventType: 'TASK_STATUS_CHANGED',
      details: { from: 'TODO', to: 'IN_PROGRESS' },
    }))).toBe('From To do to In progress.');
    expect(activityDetail(item({
      eventType: 'TASK_PRIORITY_CHANGED',
      details: { from: 'HIGH', to: 'LOW' },
    }))).toBe('From High to Low.');
    expect(activityDetail(item({
      eventType: 'TASK_ASSIGNED',
      details: {
        from: [{ id: 'a', firstName: 'Grace', lastName: 'Hopper' }],
        to: [{ id: 'b', firstName: 'Alan', lastName: 'Turing' }],
      },
    }))).toBe('From Grace Hopper to Alan Turing.');
    expect(activityAction(item({ eventType: 'TASK_DELETED' })).verb).toBe('deleted this task');
  });

  it('groups events under workspace, project, and task with the newest group first', () => {
    const olderTask = item({
      id: 'old-event',
      createdAt: '2026-10-15T10:00:00.000Z',
      workspace: { id: 'ws-a', name: 'Alpha' },
      project: { id: 'proj-a', name: 'Plans' },
      task: { id: 'task-a', title: 'Old title' },
    });
    const newerOnSameTask = item({
      id: 'new-event',
      createdAt: '2026-10-15T12:00:00.000Z',
      eventType: 'TASK_STATUS_CHANGED',
      workspace: { id: 'ws-a', name: 'Alpha' },
      project: { id: 'proj-a', name: 'Plans' },
      task: { id: 'task-a', title: 'Current title' },
      details: { from: 'TODO', to: 'DONE' },
    });
    const otherProject = item({
      id: 'other-project',
      createdAt: '2026-10-15T11:00:00.000Z',
      workspace: { id: 'ws-a', name: 'Alpha' },
      project: { id: 'proj-b', name: 'Build' },
      task: { id: 'task-b', title: 'Ship' },
    });
    const otherWorkspace = item({
      id: 'other-workspace',
      createdAt: '2026-10-15T13:00:00.000Z',
      workspace: { id: 'ws-b', name: 'Beta' },
      project: { id: 'proj-c', name: 'Research' },
      task: { id: 'task-c', title: 'Notes' },
    });

    const groups = groupActivity([olderTask, otherProject, newerOnSameTask, otherWorkspace]);
    expect(groups.map((group) => group.name)).toEqual(['Beta', 'Alpha']);
    expect(groups[1].projects.map((project) => project.name)).toEqual(['Plans', 'Build']);
    expect(groups[1].projects[0].tasks).toHaveLength(1);
    expect(groups[1].projects[0].tasks[0].title).toBe('Current title');
    expect(groups[1].projects[0].tasks[0].events.map((event) => event.id)).toEqual(['new-event', 'old-event']);
    expect(groups[0].projects[0].tasks[0].title).toBe('Notes');
  });

  it('keeps older rows when a newer page overlaps them', () => {
    const older = item({ id: 'older' });
    const kept = item({ id: 'kept' });
    const newest = item({ id: 'newest' });
    const merged = mergeNewest(
      { items: [kept, older], nextCursor: 'cursor' },
      { items: [newest, kept], nextCursor: 'next' },
    );
    expect(merged.items.map((entry) => entry.id)).toEqual(['newest', 'kept', 'older']);
    expect(merged.nextCursor).toBe('cursor');
  });
});
