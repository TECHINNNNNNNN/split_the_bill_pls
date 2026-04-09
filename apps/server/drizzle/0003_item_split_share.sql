-- Add per-member share count to item splits for weighted (ratio) splitting.
-- Default is 1 (equal split), so all existing data is automatically correct.

ALTER TABLE room_item_splits
  ADD COLUMN share integer NOT NULL DEFAULT 1
  CONSTRAINT share_range CHECK (share >= 1 AND share <= 99);
