import { z } from 'zod';

const cursorPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const activityListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().regex(cursorPattern, 'Invalid cursor').optional(),
  ),
}).transform((value) => {
  if (!value.cursor) return { limit: value.limit, cursor: null };
  const match = value.cursor.match(cursorPattern);
  return {
    limit: value.limit,
    cursor: {
      createdAt: match[1],
      id: match[2],
    },
  };
});
