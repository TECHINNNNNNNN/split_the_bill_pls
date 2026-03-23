import { pgTable, text, timestamp, boolean, uuid, integer, numeric, pgEnum, unique } from "drizzle-orm/pg-core";
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
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ════════════════════════════════════════════
// Push Notifications (for payment reminders)
// ════════════════════════════════════════════

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .references(() => roomMembers.id, { onDelete: "cascade" })
    .notNull(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushNotificationLog = pgTable("push_notification_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id")
    .references(() => roomPayments.id, { onDelete: "cascade" })
    .notNull(),
  tier: text("tier").notNull(), // "30m" | "1h" | "6h" | "24h" | "recurring-2d" | "recurring-3d" | ...
  channel: text("channel").notNull().default("web-push"), // "web-push" | "line"
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

// ════════════════════════════════════════════
// Quick Split — Room Schema
// ════════════════════════════════════════════

export const roomInviteStatusEnum = pgEnum("room_invite_status", ["pending", "accepted", "declined"]);

export const roomStatusEnum = pgEnum("room_status", ["waiting", "splitting", "payment", "settled"]);

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostName: text("host_name").notNull(),
  name: text("name"),
  expectedMembers: integer("expected_members").notNull(),
  inviteCode: text("invite_code").unique().notNull(),
  promptpayId: text("promptpay_id"),
  promptpayType: text("promptpay_type"),          // 'phone' or 'national_id'
  status: roomStatusEnum("status").default("waiting").notNull(),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
});

export const roomMembers = pgTable("room_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  isHost: boolean("is_host").default(false).notNull(),
  lineUserId: text("line_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roomBillSections = pgTable("room_bill_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 4 }),
  serviceChargeRate: numeric("service_charge_rate", { precision: 5, scale: 4 }),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
  sortOrder: integer("sort_order").default(0),
});

export const roomBillItems = pgTable("room_bill_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  sectionId: uuid("section_id")
    .references(() => roomBillSections.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const roomItemSplits = pgTable("room_item_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .references(() => roomBillItems.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => roomMembers.id, { onDelete: "cascade" })
    .notNull(),
}, (t) => [
  unique("room_item_splits_item_member_unique").on(t.itemId, t.memberId),
]);

export const roomInvites = pgTable("room_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  invitedBy: text("invited_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  displayName: text("display_name").notNull(),
  status: roomInviteStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roomPayments = pgTable("room_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => roomMembers.id, { onDelete: "cascade" })
    .notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: paymentStatusEnum("status").default("unpaid").notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  // Slip verification fields
  slipTransRef: text("slip_trans_ref"),
  slipSendingBank: text("slip_sending_bank"),
  slipImageData: text("slip_image_data"),
  slipVerifiedAmount: numeric("slip_verified_amount", { precision: 10, scale: 2 }),
  slipVerifiedAt: timestamp("slip_verified_at", { withTimezone: true }),
});

// ════════════════════════════════════════════
// Settlements (cross-room debt netting)
// ════════════════════════════════════════════

export const settlementStatusEnum = pgEnum("settlement_status", ["pending", "claimed", "confirmed", "rejected"]);

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  payerUserId: text("payer_user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  payeeUserId: text("payee_user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  netAmount: numeric("net_amount", { precision: 10, scale: 2 }).notNull(),
  status: settlementStatusEnum("status").default("pending").notNull(),
  slipImageData: text("slip_image_data"),
  slipTransRef: text("slip_trans_ref"),
  slipSendingBank: text("slip_sending_bank"),
  slipVerifiedAmount: numeric("slip_verified_amount", { precision: 10, scale: 2 }),
  slipVerifiedAt: timestamp("slip_verified_at", { withTimezone: true }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settlementPayments = pgTable("settlement_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  settlementId: uuid("settlement_id")
    .references(() => settlements.id, { onDelete: "cascade" })
    .notNull(),
  roomPaymentId: uuid("room_payment_id")
    .references(() => roomPayments.id, { onDelete: "cascade" })
    .notNull(),
});

// ════════════════════════════════════════════
// Drizzle Relations (for relational query builder)
// ════════════════════════════════════════════

export const userRelations = relations(user, ({ many }) => ({
  groups: many(groups),
  groupMemberships: many(groupMembers),
  rooms: many(rooms),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(user, { fields: [groups.createdBy], references: [user.id] }),
  members: many(groupMembers),
  rooms: many(rooms),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(user, { fields: [groupMembers.userId], references: [user.id] }),
}));

// ── Room Relations ──

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  createdBy: one(user, { fields: [rooms.createdByUserId], references: [user.id] }),
  group: one(groups, { fields: [rooms.groupId], references: [groups.id] }),
  members: many(roomMembers),
  billSections: many(roomBillSections),
  billItems: many(roomBillItems),
  payments: many(roomPayments),
  invites: many(roomInvites),
}));

export const roomBillSectionsRelations = relations(roomBillSections, ({ one, many }) => ({
  room: one(rooms, { fields: [roomBillSections.roomId], references: [rooms.id] }),
  items: many(roomBillItems),
}));

export const roomMembersRelations = relations(roomMembers, ({ one, many }) => ({
  room: one(rooms, { fields: [roomMembers.roomId], references: [rooms.id] }),
  user: one(user, { fields: [roomMembers.userId], references: [user.id] }),
  itemSplits: many(roomItemSplits),
  payments: many(roomPayments),
}));

export const roomBillItemsRelations = relations(roomBillItems, ({ one, many }) => ({
  room: one(rooms, { fields: [roomBillItems.roomId], references: [rooms.id] }),
  section: one(roomBillSections, { fields: [roomBillItems.sectionId], references: [roomBillSections.id] }),
  splits: many(roomItemSplits),
}));

export const roomItemSplitsRelations = relations(roomItemSplits, ({ one }) => ({
  item: one(roomBillItems, { fields: [roomItemSplits.itemId], references: [roomBillItems.id] }),
  member: one(roomMembers, { fields: [roomItemSplits.memberId], references: [roomMembers.id] }),
}));

export const roomInvitesRelations = relations(roomInvites, ({ one }) => ({
  room: one(rooms, { fields: [roomInvites.roomId], references: [rooms.id] }),
  user: one(user, { fields: [roomInvites.userId], references: [user.id] }),
}));

export const roomPaymentsRelations = relations(roomPayments, ({ one, many }) => ({
  room: one(rooms, { fields: [roomPayments.roomId], references: [rooms.id] }),
  member: one(roomMembers, { fields: [roomPayments.memberId], references: [roomMembers.id] }),
  notificationLogs: many(pushNotificationLog),
}));

// ── Push Notification Relations ──

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  member: one(roomMembers, { fields: [pushSubscriptions.memberId], references: [roomMembers.id] }),
  room: one(rooms, { fields: [pushSubscriptions.roomId], references: [rooms.id] }),
}));

export const pushNotificationLogRelations = relations(pushNotificationLog, ({ one }) => ({
  payment: one(roomPayments, { fields: [pushNotificationLog.paymentId], references: [roomPayments.id] }),
}));

// ── Settlement Relations ──

export const settlementsRelations = relations(settlements, ({ one, many }) => ({
  payer: one(user, { fields: [settlements.payerUserId], references: [user.id], relationName: "settlementsPaid" }),
  payee: one(user, { fields: [settlements.payeeUserId], references: [user.id], relationName: "settlementsReceived" }),
  payments: many(settlementPayments),
}));

export const settlementPaymentsRelations = relations(settlementPayments, ({ one }) => ({
  settlement: one(settlements, { fields: [settlementPayments.settlementId], references: [settlements.id] }),
  roomPayment: one(roomPayments, { fields: [settlementPayments.roomPaymentId], references: [roomPayments.id] }),
}));
