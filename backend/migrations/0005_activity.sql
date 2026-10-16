CREATE TABLE "activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks" ("id") ON DELETE SET NULL,
  "actor_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
  "event_type" text NOT NULL,
  "resource_type" text NOT NULL DEFAULT 'task',
  "resource_id" uuid NOT NULL,
  "task_title" text NOT NULL,
  "details" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "activities_event_type_valid" CHECK (
    "event_type" IN (
      'TASK_CREATED',
      'TASK_ASSIGNED',
      'TASK_STATUS_CHANGED',
      'TASK_PRIORITY_CHANGED',
      'TASK_DELETED'
    )
  ),
  CONSTRAINT "activities_resource_type_task" CHECK ("resource_type" = 'task'),
  CONSTRAINT "activities_task_title_not_blank" CHECK (char_length(btrim("task_title")) > 0)
);
--> statement-breakpoint
CREATE INDEX "activities_workspace_feed_idx"
  ON "activities" ("workspace_id", "created_at" DESC, "id" DESC);
