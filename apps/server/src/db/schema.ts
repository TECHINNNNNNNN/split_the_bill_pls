import { pgTable, text, timestamp, boolean, uuid, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  promptpayId: text("promptpay_id"),
  promptpayType: text("promptpay_type"),       // 'phone' or 'national_id'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ════════════════════════════════════════════
// Application Schema
// ════════════════════════════════════════════

export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "claimed", "confirmed", "rejected"]);
export const billStatusEnum = pgEnum("bill_status", ["draft", "active", "settled"]);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: text("created_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  inviteCode: text("invite_code").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .references(() => groups.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  isGuest: boolean("is_guest").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bills = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .references(() => groups.id, { onDelete: "cascade" })
    .notNull(),
  paidBy: text("paid_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 4 }),
  vatAmount: numeric("vat_amount", { precision: 10, scale: 2 }),
  serviceChargeRate: numeric("service_charge_rate", { precision: 5, scale: 4 }),
  serviceChargeAmount: numeric("service_charge_amount", { precision: 10, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  receiptImageUrl: text("receipt_image_url"),
  shareToken: text("share_token").unique().notNull(),
  status: billStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billItems = pgTable("bill_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .references(() => bills.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const itemClaims = pgTable("item_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  billItemId: uuid("bill_item_id")
    .references(() => billItems.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => groupMembers.id, { onDelete: "cascade" })
    .notNull(),
  shareAmount: numeric("share_amount", { precision: 10, scale: 2 }).notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .references(() => bills.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => groupMembers.id, { onDelete: "cascade" })
    .notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: paymentStatusEnum("status").default("unpaid").notNull(),
  slipImageUrl: text("slip_image_url"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .references(() => groupMembers.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ════════════════════════════════════════════
// Drizzle Relations (for relational query builder)
// ════════════════════════════════════════════

export const userRelations = relations(user, ({ many }) => ({
  groups: many(groups),
  groupMemberships: many(groupMembers),
  bills: many(bills),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(user, { fields: [groups.createdBy], references: [user.id] }),
  members: many(groupMembers),
  bills: many(bills),
}));

export const groupMembersRelations = relations(groupMembers, ({ one, many }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(user, { fields: [groupMembers.userId], references: [user.id] }),
  itemClaims: many(itemClaims),
  payments: many(payments),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  group: one(groups, { fields: [bills.groupId], references: [groups.id] }),
  payer: one(user, { fields: [bills.paidBy], references: [user.id] }),
  items: many(billItems),
  payments: many(payments),
}));

export const billItemsRelations = relations(billItems, ({ one, many }) => ({
  bill: one(bills, { fields: [billItems.billId], references: [bills.id] }),
  claims: many(itemClaims),
}));

export const itemClaimsRelations = relations(itemClaims, ({ one }) => ({
  billItem: one(billItems, { fields: [itemClaims.billItemId], references: [billItems.id] }),
  member: one(groupMembers, { fields: [itemClaims.memberId], references: [groupMembers.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  bill: one(bills, { fields: [payments.billId], references: [bills.id] }),
  member: one(groupMembers, { fields: [payments.memberId], references: [groupMembers.id] }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  member: one(groupMembers, { fields: [pushSubscriptions.memberId], references: [groupMembers.id] }),
}));
