import { priorityLabel, statusLabel, type TaskPriority, type TaskStatus } from './projectTasks';

export type ActivityPerson = {
  id: string;
  firstName: string;
  lastName: string;
};

export type ActivityEventType =
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_PRIORITY_CHANGED'
  | 'TASK_DELETED';

export type ActivityItem = {
  id: string;
  eventType: ActivityEventType;
  createdAt: string;
  actor: ActivityPerson;
  workspace: { id: string; name: string };
  project: { id: string; name: string };
  task: { id: string; title: string };
  details: {
    status?: string;
    priority?: string;
    assignees?: ActivityPerson[];
    from?: string | ActivityPerson[];
    to?: string | ActivityPerson[];
  };
};

export type ActivityFeed = {
  items: ActivityItem[];
  nextCursor: string | null;
};

const verbs: Record<ActivityEventType, string> = {
  TASK_CREATED: 'created this task',
  TASK_ASSIGNED: 'changed assignees',
  TASK_STATUS_CHANGED: 'changed the status',
  TASK_PRIORITY_CHANGED: 'changed the priority',
  TASK_DELETED: 'deleted this task',
};

const statusText = (value: string) => (value in statusLabel ? statusLabel[value as TaskStatus] : value);
const priorityText = (value: string) => (value in priorityLabel ? priorityLabel[value as TaskPriority] : value);

export const personName = (person: ActivityPerson) => `${person.firstName} ${person.lastName}`;

const names = (people: ActivityPerson[] | undefined) => {
  if (!people?.length) return 'nobody';
  return people.map(personName).join(', ');
};

export function activityAction(item: ActivityItem) {
  return {
    actor: personName(item.actor),
    verb: verbs[item.eventType],
    title: item.task.title,
  };
}

export function activityDetail(item: ActivityItem) {
  const { details } = item;
  if (item.eventType === 'TASK_CREATED') {
    return `Status ${statusText(details.status ?? '')}. Priority ${priorityText(details.priority ?? '')}. Assigned to ${names(details.assignees)}.`;
  }
  if (item.eventType === 'TASK_DELETED') {
    return `Status was ${statusText(details.status ?? '')}. Priority was ${priorityText(details.priority ?? '')}. Assignees were ${names(details.assignees)}.`;
  }
  if (item.eventType === 'TASK_STATUS_CHANGED') {
    return `From ${statusText(String(details.from ?? ''))} to ${statusText(String(details.to ?? ''))}.`;
  }
  if (item.eventType === 'TASK_PRIORITY_CHANGED') {
    return `From ${priorityText(String(details.from ?? ''))} to ${priorityText(String(details.to ?? ''))}.`;
  }
  const from = Array.isArray(details.from) ? details.from : [];
  const to = Array.isArray(details.to) ? details.to : [];
  return `From ${names(from)} to ${names(to)}.`;
}

export type ActivityTaskGroup = {
  id: string;
  title: string;
  newestAt: string;
  events: ActivityItem[];
};

export type ActivityProjectGroup = {
  id: string;
  name: string;
  newestAt: string;
  tasks: ActivityTaskGroup[];
};

export type ActivityWorkspaceGroup = {
  id: string;
  name: string;
  newestAt: string;
  projects: ActivityProjectGroup[];
};

const byNewest = (left: { newestAt: string; name: string }, right: { newestAt: string; name: string }) =>
  right.newestAt.localeCompare(left.newestAt) || left.name.localeCompare(right.name);

export function groupActivity(items: ActivityItem[]): ActivityWorkspaceGroup[] {
  const workspaces = new Map<string, {
    id: string;
    name: string;
    projects: Map<string, {
      id: string;
      name: string;
      tasks: Map<string, ActivityItem[]>;
    }>;
  }>();

  for (const item of items) {
    let workspace = workspaces.get(item.workspace.id);
    if (!workspace) {
      workspace = { id: item.workspace.id, name: item.workspace.name, projects: new Map() };
      workspaces.set(item.workspace.id, workspace);
    }
    let project = workspace.projects.get(item.project.id);
    if (!project) {
      project = { id: item.project.id, name: item.project.name, tasks: new Map() };
      workspace.projects.set(item.project.id, project);
    }
    const events = project.tasks.get(item.task.id) ?? [];
    events.push(item);
    project.tasks.set(item.task.id, events);
  }

  return [...workspaces.values()].map((workspace) => {
    const projects = [...workspace.projects.values()].map((project) => {
      const tasks = [...project.tasks.values()].map((events) => {
        const ordered = [...events].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
        return {
          id: ordered[0].task.id,
          title: ordered[0].task.title,
          newestAt: ordered[0].createdAt,
          events: ordered,
        };
      }).sort((left, right) => right.newestAt.localeCompare(left.newestAt) || left.title.localeCompare(right.title));
      return {
        id: project.id,
        name: project.name,
        newestAt: tasks[0].newestAt,
        tasks,
      };
    }).sort(byNewest);
    return {
      id: workspace.id,
      name: workspace.name,
      newestAt: projects[0].newestAt,
      projects,
    };
  }).sort(byNewest);
}

export function mergeNewest(current: ActivityFeed, page: ActivityFeed): ActivityFeed {
  if (current.items.length === 0) return page;
  const newestIds = new Set(page.items.map((item) => item.id));
  const overlap = current.items.some((item) => newestIds.has(item.id));
  if (!overlap) return page;
  const older = current.items.filter((item) => !newestIds.has(item.id));
  return {
    items: [...page.items, ...older],
    nextCursor: older.length > 0 ? current.nextCursor : page.nextCursor,
  };
}
