CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "roles_title_unique" UNIQUE ("title"),
  CONSTRAINT "roles_title_not_blank" CHECK (char_length(btrim("title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "permissions_title_unique" UNIQUE ("title"),
  CONSTRAINT "permissions_title_not_blank" CHECK (char_length(btrim("title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES "permissions" ("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
--> statement-breakpoint
-- Authorization checks join role permissions by permission as well as role.
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" ("permission_id");
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "is_verified" boolean NOT NULL DEFAULT false,
  "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE RESTRICT,
  "activation_otp_hash" text,
  "activation_otp_expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "users_email_unique" UNIQUE ("email"),
  CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email")),
  CONSTRAINT "users_first_name_not_blank" CHECK (char_length(btrim("first_name")) > 0),
  CONSTRAINT "users_last_name_not_blank" CHECK (char_length(btrim("last_name")) > 0)
);
--> statement-breakpoint
-- Every authenticated permission lookup joins users to their global role.
CREATE INDEX "users_role_id_idx" ON "users" ("role_id");
--> statement-breakpoint
CREATE TABLE "refresh_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jti_hash" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "family_id" uuid NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "replaced_at" timestamptz,
  "csrf_hash" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "refresh_sessions_jti_hash_unique" UNIQUE ("jti_hash")
);
--> statement-breakpoint
-- Replay detection loads the rotated family, including rows already replaced or revoked.
CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions" ("family_id");
--> statement-breakpoint
-- Password changes and resets revoke every session belonging to the user.
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions" ("user_id");
--> statement-breakpoint
-- Cleanup deletes a session only after expires_at, whether or not it was replaced or revoked.
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions" ("expires_at");
--> statement-breakpoint
CREATE TABLE "blacklist_tokens" (
  "token_hash" text PRIMARY KEY,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Cleanup deletes an access-token digest only after the token's own expiry.
CREATE INDEX "blacklist_tokens_expires_at_idx" ON "blacklist_tokens" ("expires_at");
--> statement-breakpoint
INSERT INTO "roles" ("title") VALUES ('user') ON CONFLICT ("title") DO NOTHING;
