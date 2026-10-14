import { HTTP_STATUS } from './constants.js';

export const successResponse = (res, { statusCode = HTTP_STATUS.OK, message = 'Success', data = null } = {}) =>
  res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
  });

export const errorResponse = (res, { statusCode = HTTP_STATUS.SERVER_ERROR, message = 'Something went wrong', data = null } = {}) =>
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    data,
  });

export const unauthorizeResponse = (res, message = 'Unauthorized') =>
  errorResponse(res, { statusCode: HTTP_STATUS.UNAUTHORIZED, message });
