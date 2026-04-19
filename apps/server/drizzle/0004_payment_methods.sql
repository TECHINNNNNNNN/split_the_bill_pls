-- Add payment method fields to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS payment_note text;
