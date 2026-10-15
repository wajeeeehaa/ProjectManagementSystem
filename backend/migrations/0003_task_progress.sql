ALTER TABLE "tasks"
  ADD COLUMN "progress" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100);
