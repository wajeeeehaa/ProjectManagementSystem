CREATE TABLE "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workspaces_name_not_blank" CHECK (char_length(btrim("name")) > 0)
);
--> statement-breakpoint
CREATE INDEX "workspaces_created_by_idx" ON "workspaces" ("created_by");
--> statement-breakpoint
CREATE TABLE "workspace_members" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("workspace_id", "user_id"),
  CONSTRAINT "workspace_members_role_valid" CHECK ("role" IN ('owner', 'admin', 'member'))
);
--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" ("user_id");
--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_id_role_idx" ON "workspace_members" ("workspace_id", "role");
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_one_owner_per_workspace"
  ON "workspace_members" ("workspace_id") WHERE "role" = 'owner';
