-- Add payment method fields to rooms
ALTER TABLE rooms ADD COLUMN payment_method text;
ALTER TABLE rooms ADD COLUMN bank_account_number text;
ALTER TABLE rooms ADD COLUMN payment_note text;
