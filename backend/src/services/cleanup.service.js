import { CLEANUP_INTERVAL_MS } from '../utils/constants.js';
import { cleanupExpiredAuthRecords } from './session.service.js';

export const startAuthCleanup = () => {
  const run = () => {
    cleanupExpiredAuthRecords().catch((error) => {
      console.error('[cleanup] failed', error instanceof Error ? error.message : 'unknown error');
    });
  };

  run();
  const timer = setInterval(run, CLEANUP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
