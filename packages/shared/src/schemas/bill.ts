import { z } from "zod"

// ─── Enums ───────────────────────────────────

export const paymentStatusSchema = z.enum(["unpaid", "claimed", "confirmed", "rejected"])
export const promptpayTypeSchema = z.enum(["phone", "national_id"])

export type PaymentStatus = z.infer<typeof paymentStatusSchema>
export type PromptpayType = z.infer<typeof promptpayTypeSchema>

// ─── Group Schemas ───────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
})

// ─── Room Schemas (Quick Split) ─────────────

export const roomStatusSchema = z.enum(["waiting", "splitting", "payment", "settled"])

export const createRoomSchema = z.object({
  hostName: z.string().min(1).max(50),
  expectedMembers: z.number().int().min(1),
  name: z.string().max(100).optional(),
})

export const joinRoomSchema = z.object({
  displayName: z.string().min(1).max(50),
})

export const addRoomItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().positive(),
})

export const setRoomItemSplitsSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
})

const billItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().positive(),
  memberIds: z.array(z.string().uuid()).min(1),
})

const billExtrasSchema = z.object({
  vatRate: z.number().min(0).max(1).nullable().optional(),               // e.g. 0.07 for 7%
  serviceChargeRate: z.number().min(0).max(1).nullable().optional(),     // e.g. 0.10 for 10%
  discountAmount: z.number().min(0).nullable().optional(),               // flat baht amount
})

export const billSectionSchema = z.object({
  name: z.string().max(200),
  items: z.array(billItemSchema).min(1),
}).merge(billExtrasSchema)

export const finalizeRoomSchema = z.object({
  // Legacy flat format (used when no sections)
  items: z.array(billItemSchema).optional(),
  // New: per-section format — each section has its own items + extras
  sections: z.array(billSectionSchema).optional(),
}).merge(billExtrasSchema)
// Either items or sections must be provided (validated server-side)

export const setRoomPaymentMethodSchema = z.object({
  promptpayId: z.string().min(10).max(13),
  promptpayType: promptpayTypeSchema,
})

export const claimRoomPaymentSchema = z.object({
  transRef: z.string().min(1).optional(),
  sendingBank: z.string().min(1).optional(),
  qrData: z.string().min(1).optional(),
  slipImage: z.string().optional(),
})

export const updateRoomStatusSchema = z.object({
  status: roomStatusSchema,
})

// ─── Receipt OCR Scan ─────────────────────────

export const scanReceiptSchema = z.object({
  image: z.string().min(1),  // base64-encoded image
})

export const startGroupSplitSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
})

// ─── Push Notifications ─────────────────────

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
})

// ─── LINE Messaging ─────────────────────────

export const lineLinkSchema = z.object({
  idToken: z.string().min(1),
})

// ─── Derived Types ───────────────────────────

export type CreateGroup = z.infer<typeof createGroupSchema>

export type RoomStatus = z.infer<typeof roomStatusSchema>
export type CreateRoom = z.infer<typeof createRoomSchema>
export type JoinRoom = z.infer<typeof joinRoomSchema>
export type AddRoomItem = z.infer<typeof addRoomItemSchema>
export type SetRoomItemSplits = z.infer<typeof setRoomItemSplitsSchema>
export type BillSection = z.infer<typeof billSectionSchema>
export type FinalizeRoom = z.infer<typeof finalizeRoomSchema>
export type SetRoomPaymentMethod = z.infer<typeof setRoomPaymentMethodSchema>
export type ClaimRoomPayment = z.infer<typeof claimRoomPaymentSchema>
export type StartGroupSplit = z.infer<typeof startGroupSplitSchema>
export type ScanReceipt = z.infer<typeof scanReceiptSchema>
export type ScanReceiptResponse = z.infer<typeof scanReceiptResponseSchema>
export type PushSubscribe = z.infer<typeof pushSubscribeSchema>
export type LineLink = z.infer<typeof lineLinkSchema>

// ─── Settlements ────────────────────────────

export const settleUpSchema = z.object({
  otherUserId: z.string().min(1),
  slipImage: z.string().optional(),
  transRef: z.string().optional(),
  sendingBank: z.string().optional(),
})

export type SettleUp = z.infer<typeof settleUpSchema>
