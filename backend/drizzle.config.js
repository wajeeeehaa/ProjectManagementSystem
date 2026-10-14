import { defineConfig } from 'drizzle-kit';
import './src/utils/loadEnv.js';

export default defineConfig({
  schema: './db/schema/index.js',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
