import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { HTTP_STATUS, SERVER_HOST, SERVER_PORT } from './utils/constants.js';
import { errorResponse } from './utils/customResponses.js';
import routes from './routes/index.js';

const app = express();

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
  console.error('[error]', error);
  return errorResponse(res, {
    statusCode: HTTP_STATUS.SERVER_ERROR,
    message: 'Something went wrong',
  });
});

app.listen(SERVER_PORT, SERVER_HOST, () => {
  console.log(`[server] listening on ${SERVER_HOST}:${SERVER_PORT}`);
});

export default app;
