import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { successResponse } from '../utils/customResponses.js';
import { publishActivities } from '../services/realtime.service.js';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from '../services/task.service.js';

export const create = asyncHandler(async (req, res) => {
  const task = await createTask(
    req.params.workspaceId,
    req.params.projectId,
    req.userId,
    res.locals.validatedInput,
  );
  await publishActivities(task.activities);
  return successResponse(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Task created',
    data: await getTask(req.params.workspaceId, req.params.projectId, task.id),
  });
});

export const list = asyncHandler(async (req, res) =>
  successResponse(res, {
    data: await listTasks(req.params.workspaceId, req.params.projectId, res.locals.validatedInput),
  }));

export const get = asyncHandler(async (req, res) =>
  successResponse(res, {
    data: await getTask(req.params.workspaceId, req.params.projectId, req.params.taskId),
  }));

export const update = asyncHandler(async (req, res) => {
  const task = await updateTask(
    req.params.workspaceId,
    req.params.projectId,
    req.params.taskId,
    req.userId,
    req.workspaceRole,
    res.locals.validatedInput,
  );
  await publishActivities(task.activities);
  return successResponse(res, {
    message: 'Task updated',
    data: await getTask(req.params.workspaceId, req.params.projectId, task.id),
  });
});

export const remove = asyncHandler(async (req, res) => {
  const task = await deleteTask(
    req.params.workspaceId,
    req.params.projectId,
    req.params.taskId,
    req.userId,
  );
  await publishActivities(task.activities);
  return successResponse(res, { message: 'Task deleted' });
});
