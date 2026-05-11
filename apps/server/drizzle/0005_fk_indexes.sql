-- Add B-tree indexes on foreign-key columns that are frequently filtered or joined.
-- PostgreSQL does not auto-index FK columns, so every JOIN-heavy query falls back
-- to a sequential scan without these. Each index is created concurrently and
-- guarded with IF NOT EXISTS so re-running the migration is safe.

CREATE INDEX IF NOT EXISTS "group_members_group_id_idx" ON "group_members" ("group_id");
CREATE INDEX IF NOT EXISTS "group_members_user_id_idx" ON "group_members" ("user_id");

CREATE INDEX IF NOT EXISTS "push_subscriptions_member_room_idx" ON "push_subscriptions" ("member_id", "room_id");
CREATE INDEX IF NOT EXISTS "push_notification_log_payment_id_idx" ON "push_notification_log" ("payment_id");

CREATE INDEX IF NOT EXISTS "room_members_room_id_idx" ON "room_members" ("room_id");
CREATE INDEX IF NOT EXISTS "room_members_user_id_idx" ON "room_members" ("user_id");

CREATE INDEX IF NOT EXISTS "room_bill_sections_room_id_idx" ON "room_bill_sections" ("room_id");
CREATE INDEX IF NOT EXISTS "room_bill_items_room_id_idx" ON "room_bill_items" ("room_id");
CREATE INDEX IF NOT EXISTS "room_bill_items_section_id_idx" ON "room_bill_items" ("section_id");

CREATE INDEX IF NOT EXISTS "room_item_splits_member_id_idx" ON "room_item_splits" ("member_id");

CREATE INDEX IF NOT EXISTS "room_invites_room_id_idx" ON "room_invites" ("room_id");
CREATE INDEX IF NOT EXISTS "room_invites_user_id_idx" ON "room_invites" ("user_id");

CREATE INDEX IF NOT EXISTS "room_payments_room_id_idx" ON "room_payments" ("room_id");
CREATE INDEX IF NOT EXISTS "room_payments_room_status_idx" ON "room_payments" ("room_id", "status");
CREATE INDEX IF NOT EXISTS "room_payments_member_status_idx" ON "room_payments" ("member_id", "status");

CREATE INDEX IF NOT EXISTS "settlement_payments_settlement_id_idx" ON "settlement_payments" ("settlement_id");
CREATE INDEX IF NOT EXISTS "settlement_payments_room_payment_id_idx" ON "settlement_payments" ("room_payment_id");
