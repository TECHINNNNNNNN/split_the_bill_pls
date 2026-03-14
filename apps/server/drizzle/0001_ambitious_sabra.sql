ALTER TABLE "room_payments" ADD COLUMN "status" "payment_status" DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "room_payments" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "room_payments" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "room_payments" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "room_payments" DROP COLUMN "is_paid";--> statement-breakpoint
ALTER TABLE "room_payments" DROP COLUMN "paid_at";