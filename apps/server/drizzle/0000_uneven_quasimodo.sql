CREATE TYPE "public"."bill_status" AS ENUM('draft', 'active', 'settled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'claimed', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('waiting', 'splitting', 'payment', 'settled');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"paid_by" text NOT NULL,
	"name" text NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"vat_rate" numeric(5, 4),
	"vat_amount" numeric(10, 2),
	"service_charge_rate" numeric(5, 4),
	"service_charge_amount" numeric(10, 2),
	"total_amount" numeric(10, 2) NOT NULL,
	"receipt_image_url" text,
	"share_token" text NOT NULL,
	"status" "bill_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"is_guest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"invite_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "item_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_item_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"share_amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"slip_image_url" text,
	"claimed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "room_item_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "room_item_splits_item_member_unique" UNIQUE("item_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "room_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_name" text NOT NULL,
	"expected_members" integer NOT NULL,
	"invite_code" text NOT NULL,
	"promptpay_id" text,
	"promptpay_type" text,
	"status" "room_status" DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"promptpay_id" text,
	"promptpay_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_claims" ADD CONSTRAINT "item_claims_bill_item_id_bill_items_id_fk" FOREIGN KEY ("bill_item_id") REFERENCES "public"."bill_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_claims" ADD CONSTRAINT "item_claims_member_id_group_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_group_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_member_id_group_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_bill_items" ADD CONSTRAINT "room_bill_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_item_splits" ADD CONSTRAINT "room_item_splits_item_id_room_bill_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."room_bill_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_item_splits" ADD CONSTRAINT "room_item_splits_member_id_room_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."room_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_payments" ADD CONSTRAINT "room_payments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_payments" ADD CONSTRAINT "room_payments_member_id_room_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."room_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;