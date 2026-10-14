import { ZodError } from 'zod';
import { HTTP_STATUS } from '../utils/constants.js';
import { errorResponse } from '../utils/customResponses.js';

export const validationMiddleware = (
  schema,
  selector = (req) => req.body,
  localsKey = 'validatedInput',
) => (req, res, next) => {
  try {
    const parsed = schema.parse(selector(req));
    res.locals[localsKey] = parsed;
    return next();
  } catch (error) {
    if (!(error instanceof ZodError)) {
      return next(error);
    }

    const message = error.issues.map((issue) => ({
      field: issue.path[0],
      message: issue.message,
    }));

    return errorResponse(res, {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message,
    });
  }
};

export default validationMiddleware;
