-- Indexes on Better Auth tables for the high-traffic lookups it performs on
-- every authenticated request and on every OAuth callback. Better Auth's own
-- performance guide explicitly recommends these. UNIQUE on session.token and
-- user.email already gives us implicit indexes on those columns.

CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id");
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
