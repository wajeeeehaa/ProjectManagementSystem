CREATE TABLE "task_assignees" (
  "task_id" uuid NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
  PRIMARY KEY ("task_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees" ("user_id");
--> statement-breakpoint
INSERT INTO "task_assignees" ("task_id", "user_id")
SELECT "id", "assignee_id" FROM "tasks";
