import { asyncHandler } from '../utils/asyncHandler.js';
import { successResponse } from '../utils/customResponses.js';
import { listActivity } from '../services/activity.service.js';

export const list = asyncHandler(async (req, res) =>
  successResponse(res, {
    data: await listActivity(req.userId, res.locals.validatedInput),
  }));
