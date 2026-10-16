import { and, eq } from 'drizzle-orm';
import { hashPassword } from '../src/utils/password.helper.js';
import { db, pool } from './database.js';
import { projects, roles, taskAssignees, tasks, users, workspaceMembers, workspaces, activities } from './schema/index.js';

if (!db || !pool) {
  console.error('[db] DATABASE_URL is empty');
  process.exit(1);
}

const SEED_PASSWORD = 'ChangeMe!12345';

const people = [
  { key: 'owner', email: 'wajeeha.owner@gmail.com', firstName: 'Wajeeha', lastName: 'Owner' },
  { key: 'admin', email: 'wajeeha.admin@gmail.com', firstName: 'Wajeeha', lastName: 'Admin' },
  { key: 'member1', email: 'wajeeha.member1@gmail.com', firstName: 'Wajeeha', lastName: 'Member One' },
  { key: 'member2', email: 'wajeeha.member2@gmail.com', firstName: 'Wajeeha', lastName: 'Member Two' },
  { key: 'member3', email: 'wajeeha.member3@gmail.com', firstName: 'Wajeeha', lastName: 'Member Three' },
];

const workspaceSeeds = [
  {
    name: 'Seed Delivery',
    owner: 'owner',
    members: [
      { key: 'admin', role: 'admin' },
      { key: 'member1', role: 'member' },
      { key: 'member2', role: 'member' },
    ],
    projects: [
      {
        name: 'Launch checklist',
        description: 'Release work assigned to Members.',
        tasks: [
          {
            title: 'Draft release notes',
            description: 'Summarize the changes for the next release.',
            status: 'TODO',
            priority: 'HIGH',
            assignee: 'member1',
            dueDate: new Date('2026-11-20T00:00:00.000Z'),
          },
          {
            title: 'Prepare launch email',
            description: 'Write the announcement for workspace members.',
            status: 'IN_PROGRESS',
            priority: 'MEDIUM',
            assignee: 'member2',
            dueDate: new Date('2026-11-28T00:00:00.000Z'),
          },
        ],
      },
    ],
  },
  {
    name: 'Seed Research',
    owner: 'member1',
    members: [
      { key: 'admin', role: 'admin' },
      { key: 'member2', role: 'member' },
      { key: 'member3', role: 'member' },
    ],
    projects: [
      {
        name: 'Findings',
        description: 'Research tasks assigned only to Members.',
        tasks: [
          {
            title: 'Collect interview notes',
            description: 'Gather notes from the first round of interviews.',
            status: 'TODO',
            priority: 'LOW',
            assignee: 'member2',
            dueDate: new Date('2026-12-05T00:00:00.000Z'),
          },
          {
            title: 'Summarize open questions',
            description: 'List the questions that still need an answer.',
            status: 'DONE',
            priority: 'MEDIUM',
            assignee: 'member3',
            dueDate: new Date('2026-12-12T00:00:00.000Z'),
          },
        ],
      },
    ],
  },
];

const ensureUser = async (tx, roleId, passwordHash, person) => {
  const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, person.email)).limit(1);
  if (existing) {
    await tx
      .update(users)
      .set({
        passwordHash,
        firstName: person.firstName,
        lastName: person.lastName,
        isVerified: true,
        activationOtpHash: null,
        activationOtpExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const [created] = await tx
    .insert(users)
    .values({
      email: person.email,
      passwordHash,
      firstName: person.firstName,
      lastName: person.lastName,
      isVerified: true,
      roleId,
    })
    .returning({ id: users.id });
  return created.id;
};

const ensureWorkspace = async (tx, name, ownerId) => {
  const [existing] = await tx
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, ownerId), eq(workspaceMembers.role, 'owner')),
    )
    .where(eq(workspaces.name, name))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx.insert(workspaces).values({ name, createdBy: ownerId }).returning({ id: workspaces.id });
  await tx.insert(workspaceMembers).values({ workspaceId: created.id, userId: ownerId, role: 'owner' });
  return created.id;
};

const ensureMembership = async (tx, workspaceId, userId, role) => {
  const [existing] = await tx
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  if (!existing) {
    await tx.insert(workspaceMembers).values({ workspaceId, userId, role });
    return;
  }
  if (existing.role !== role) {
    await tx
      .update(workspaceMembers)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  }
};

const ensureProject = async (tx, workspaceId, project, createdBy) => {
  const [existing] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.name, project.name)))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(projects)
    .values({
      workspaceId,
      name: project.name,
      description: project.description,
      createdBy,
    })
    .returning({ id: projects.id });
  return created.id;
};

const ensureCreatedActivity = async (tx, workspaceId, projectId, taskId, task, assigneeId, createdBy) => {
  const [existing] = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.resourceId, taskId), eq(activities.eventType, 'TASK_CREATED')))
    .limit(1);
  if (existing) return;

  const [assignee] = await tx
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, assigneeId))
    .limit(1);
  await tx.insert(activities).values({
    workspaceId,
    projectId,
    taskId,
    actorId: createdBy,
    eventType: 'TASK_CREATED',
    resourceType: 'task',
    resourceId: taskId,
    taskTitle: task.title,
    details: {
      status: task.status,
      priority: task.priority,
      assignees: assignee ? [assignee] : [],
    },
  });
};

const ensureTask = async (tx, workspaceId, projectId, task, assigneeId, createdBy) => {
  const [existing] = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.title, task.title)))
    .limit(1);
  const taskId = existing?.id ?? (await tx.insert(tasks).values({
    workspaceId,
    projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId,
    dueDate: task.dueDate,
    createdBy,
  }).returning({ id: tasks.id }))[0].id;

  await tx.insert(taskAssignees).values({ taskId, userId: assigneeId }).onConflictDoNothing();
  await ensureCreatedActivity(tx, workspaceId, projectId, taskId, task, assigneeId, createdBy);
};

await db.insert(roles).values({ title: 'user' }).onConflictDoNothing({ target: roles.title });
const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.title, 'user')).limit(1);
if (!role) {
  console.error('[db] default user role was not created');
  process.exit(1);
}

const passwordHash = await hashPassword(SEED_PASSWORD);

await db.transaction(async (tx) => {
  const userIds = {};
  for (const person of people) {
    userIds[person.key] = await ensureUser(tx, role.id, passwordHash, person);
  }

  for (const workspace of workspaceSeeds) {
    const ownerId = userIds[workspace.owner];
    const workspaceId = await ensureWorkspace(tx, workspace.name, ownerId);
    for (const member of workspace.members) {
      await ensureMembership(tx, workspaceId, userIds[member.key], member.role);
    }
    for (const project of workspace.projects) {
      const projectId = await ensureProject(tx, workspaceId, project, ownerId);
      for (const task of project.tasks) {
        await ensureTask(tx, workspaceId, projectId, task, userIds[task.assignee], ownerId);
      }
    }
  }
});

await pool.end();
console.log('[db] seed accounts, workspaces, and task activity are present');
console.log('[db] password for every seed account: ChangeMe!12345');
for (const person of people) {
  console.log(`[db] ${person.email}`);
}
