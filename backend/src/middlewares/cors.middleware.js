import cors from 'cors';
import { CORS_ORIGINS } from '../utils/constants.js';

const originOption = (origin, callback) => {
  if (!origin || CORS_ORIGINS.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(null, false);
};

export const publicCors = cors({
  origin: originOption,
  credentials: false,
});

export const privateCors = cors({
  origin: originOption,
  credentials: true,
});
