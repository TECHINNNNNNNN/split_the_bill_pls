-- ════════════════════════════════════════════
-- AI text-to-SQL: read-only views + role
-- ════════════════════════════════════════════
--
-- These views are pure SELECT projections over existing tables.
-- No new columns, no data migrations.
--
-- Security model:
--   1. The `ai_readonly` Postgres role only has SELECT on these views
--      (and the underlying tables, required by security_invoker).
--   2. Each view filters rows by `current_setting('app.user_id', true)`.
--      The server sets this GUC inside a transaction before running the
--      LLM-generated SQL, so the view automatically scopes to the
--      authenticated user — the LLM cannot bypass it.
--   3. A SELECT-only AST validator runs in the server before the query
--      reaches Postgres.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── v_user_spending ─────────────────────────────────────────────
-- One row per payment in a room the current user is in.
CREATE OR REPLACE VIEW v_user_spending AS
SELECT
  rm_me.user_id                                        AS user_id,
  r.id                                                 AS room_id,
  COALESCE(r.name, r.host_name || '''s Split')         AS room_name,
  rp.id                                                AS payment_id,
  rp.amount::numeric                                   AS amount,
  rm_me.is_host                                        AS is_user_host,
  rm_payer.is_host                                     AS payer_is_host,
  rm_payer.display_name                                AS payer_display_name,
  rp.status                                            AS status,
  rp.confirmed_at                                      AS confirmed_at,
  rp.claimed_at                                        AS claimed_at,
  r.created_at                                         AS room_created_at
FROM room_payments rp
JOIN rooms r              ON rp.room_id = r.id
JOIN room_members rm_payer ON rp.member_id = rm_payer.id
JOIN room_members rm_me    ON rm_me.room_id = r.id
WHERE r.status IN ('payment', 'settled')
  AND rm_me.user_id = current_setting('app.user_id', true);

-- ── v_room_summary ──────────────────────────────────────────────
-- One row per room the current user is in.
CREATE OR REPLACE VIEW v_room_summary AS
SELECT
  rm_me.user_id                                         AS user_id,
  r.id                                                  AS room_id,
  COALESCE(r.name, r.host_name || '''s Split')          AS room_name,
  r.host_name                                           AS host_name,
  r.status                                              AS status,
  r.created_at                                          AS created_at,
  r.finalized_at                                        AS finalized_at,
  r.invite_code                                         AS invite_code,
  rm_me.is_host                                         AS is_user_host,
  COALESCE(SUM(rp.amount::numeric) FILTER (WHERE rp.status = 'confirmed'), 0) AS total_confirmed,
  COALESCE(SUM(rp.amount::numeric), 0)                  AS total_amount,
  (SELECT COUNT(*) FROM room_members rm2 WHERE rm2.room_id = r.id) AS member_count
FROM rooms r
JOIN room_members rm_me ON rm_me.room_id = r.id
LEFT JOIN room_payments rp ON rp.room_id = r.id
WHERE r.status IN ('payment', 'settled')
  AND rm_me.user_id = current_setting('app.user_id', true)
GROUP BY r.id, rm_me.user_id, rm_me.is_host;

-- ── v_member_balances ───────────────────────────────────────────
-- One row per (current user, counterparty) pair with their unpaid/claimed balance.
CREATE OR REPLACE VIEW v_member_balances AS
WITH debts AS (
  SELECT
    rm_me.user_id                                      AS user_id,
    CASE
      WHEN rm_me.is_host = true  THEN rm_other.display_name
      WHEN rm_me.is_host = false THEN rm_host.display_name
    END                                                AS counterparty_name,
    CASE
      WHEN rm_me.is_host = true  THEN 'they_owe_me'
      WHEN rm_me.is_host = false THEN 'i_owe_them'
    END                                                AS direction,
    rp.amount::numeric                                 AS amount
  FROM room_payments rp
  JOIN rooms r              ON rp.room_id = r.id
  JOIN room_members rm_me   ON rm_me.room_id = r.id
                           AND rm_me.user_id = current_setting('app.user_id', true)
  JOIN room_members rm_host ON rm_host.room_id = r.id AND rm_host.is_host = true
  JOIN room_members rm_other ON rp.member_id = rm_other.id
  WHERE rp.status IN ('unpaid', 'claimed')
    AND r.status IN ('payment', 'settled')
    AND (
      (rm_me.is_host = true  AND rm_other.is_host = false)
      OR
      (rm_me.is_host = false AND rp.member_id = rm_me.id)
    )
)
SELECT
  user_id,
  counterparty_name,
  direction,
  SUM(amount)  AS total_amount,
  COUNT(*)     AS bill_count
FROM debts
WHERE counterparty_name IS NOT NULL
GROUP BY user_id, counterparty_name, direction;

-- ── ai_readonly role ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_readonly') THEN
    CREATE ROLE ai_readonly NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO ai_readonly;
GRANT SELECT ON v_user_spending, v_room_summary, v_member_balances TO ai_readonly;

-- security_invoker so the view executes with the caller's privileges,
-- not the view owner's.
ALTER VIEW v_user_spending  SET (security_invoker = true);
ALTER VIEW v_room_summary   SET (security_invoker = true);
ALTER VIEW v_member_balances SET (security_invoker = true);

-- Underlying tables that the views read from — required by security_invoker.
GRANT SELECT ON room_payments, rooms, room_members, room_bill_items TO ai_readonly;

-- Trigram indexes for fuzzy room name search (search_rooms tool).
CREATE INDEX IF NOT EXISTS rooms_name_trgm_idx       ON rooms USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS rooms_host_name_trgm_idx  ON rooms USING gin (host_name gin_trgm_ops);
