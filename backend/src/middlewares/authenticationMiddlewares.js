import { HTTP_STATUS } from '../utils/constants.js';
import { errorResponse } from '../utils/customResponses.js';

const notImplemented = (res) =>
  errorResponse(res, {
    statusCode: HTTP_STATUS.NOT_IMPLEMENTED,
    message: 'Not implemented',
  });

export const authentication = (req, res, next) => {
  void req;
  void next;
  return notImplemented(res);
};

export const authorization = (requiredPermissions = []) => (req, res, next) => {
  void requiredPermissions;
  void req;
  void next;
  return notImplemented(res);
};
