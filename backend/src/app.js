import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { HTTP_STATUS, SERVER_HOST, SERVER_PORT } from './utils/constants.js';
import { errorResponse } from './utils/customResponses.js';
import { HttpError } from './utils/httpError.js';
import routes from './routes/index.js';
import { startAuthCleanup } from './services/cleanup.service.js';
import { attachActivityStream } from './services/realtime.service.js';

export const createApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.set('strict routing', true);
  app.disable('x-powered-by');
  app.use(express.json());

  const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
  app.use('/uploads', express.static(uploadsDir));
  app.use('/api', routes);

  app.use((req, res) => {
    void req;
    return errorResponse(res, {
      statusCode: HTTP_STATUS.NOT_FOUND,
      message: 'Not found',
    });
  });

  app.use((error, req, res, next) => {
    void req;
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) {
      return errorResponse(res, {
        statusCode: error.statusCode,
        message: error.message,
      });
    }
    if (error?.name === 'JwtConfigurationError') {
      console.error('[config]', error.message);
      return errorResponse(res, {
        statusCode: HTTP_STATUS.SERVER_ERROR,
        message: 'Something went wrong',
      });
    }
    if (error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, 'body')) {
      return errorResponse(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid JSON',
      });
    }
    console.error('[error]', error);
    return errorResponse(res, {
      statusCode: HTTP_STATUS.SERVER_ERROR,
      message: 'Something went wrong',
    });
  });

  return app;
};

const app = createApp();
const entryPath = process.argv[1];
const isMain = Boolean(entryPath) && import.meta.url === pathToFileURL(entryPath).href;

if (isMain) {
  const timer = startAuthCleanup();
  const server = app.listen(SERVER_PORT, SERVER_HOST, () => {
    console.log(`[server] listening on ${SERVER_HOST}:${SERVER_PORT}`);
  });
  const activityStream = attachActivityStream(server);
  const shutdown = () => {
    clearInterval(timer);
    activityStream.close();
    server.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
