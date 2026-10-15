CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "created_by" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "projects_name_not_blank" CHECK (char_length(btrim("name")) > 0),
  CONSTRAINT "projects_workspace_id_id_unique" UNIQUE ("workspace_id", "id")
);
--> statement-breakpoint
CREATE INDEX "projects_workspace_id_created_at_idx"
  ON "projects" ("workspace_id", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'TODO',
  "priority" text NOT NULL DEFAULT 'MEDIUM',
  "assignee_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
  "due_date" timestamptz NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tasks_project_workspace_fk"
    FOREIGN KEY ("workspace_id", "project_id")
    REFERENCES "projects" ("workspace_id", "id")
    ON DELETE CASCADE,
  CONSTRAINT "tasks_title_not_blank" CHECK (char_length(btrim("title")) > 0),
  CONSTRAINT "tasks_status_valid" CHECK ("status" IN ('TODO', 'IN_PROGRESS', 'DONE')),
  CONSTRAINT "tasks_priority_valid" CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH')),
  CONSTRAINT "tasks_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE INDEX "tasks_project_id_created_at_idx"
  ON "tasks" ("project_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "tasks_project_id_status_idx" ON "tasks" ("project_id", "status");
--> statement-breakpoint
CREATE INDEX "tasks_project_id_priority_idx" ON "tasks" ("project_id", "priority");
--> statement-breakpoint
CREATE INDEX "tasks_workspace_id_assignee_id_idx"
  ON "tasks" ("workspace_id", "assignee_id");
--> statement-breakpoint
CREATE INDEX "tasks_project_id_due_date_idx" ON "tasks" ("project_id", "due_date");
