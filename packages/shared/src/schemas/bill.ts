import { z } from "zod"

// ─── Health Check ────────────────────────────

export const healthCheckResponseSchema = z.object({
    status: z.string(),
    timestamp: z.string()
});

export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;

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
})

export const joinRoomSchema = z.object({
  displayName: z.string().min(1).max(50),
})

export const addRoomItemSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
})

export const setRoomItemSplitsSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
})

export const finalizeRoomSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    amount: z.number().positive(),
    memberIds: z.array(z.string().uuid()).min(1),
  })).min(1),
})

export const setRoomPaymentMethodSchema = z.object({
  promptpayId: z.string().min(10).max(13),
  promptpayType: promptpayTypeSchema,
})

export const claimRoomPaymentSchema = z.object({
  transRef: z.string().min(1).optional(),
  sendingBank: z.string().min(1).optional(),
  slipImage: z.string().optional(),
})

export const updateRoomStatusSchema = z.object({
  status: roomStatusSchema,
})

export const startGroupSplitSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
})

// ─── Derived Types ───────────────────────────

export type CreateGroup = z.infer<typeof createGroupSchema>

export type RoomStatus = z.infer<typeof roomStatusSchema>
export type CreateRoom = z.infer<typeof createRoomSchema>
export type JoinRoom = z.infer<typeof joinRoomSchema>
export type AddRoomItem = z.infer<typeof addRoomItemSchema>
export type SetRoomItemSplits = z.infer<typeof setRoomItemSplitsSchema>
export type FinalizeRoom = z.infer<typeof finalizeRoomSchema>
export type SetRoomPaymentMethod = z.infer<typeof setRoomPaymentMethodSchema>
export type ClaimRoomPayment = z.infer<typeof claimRoomPaymentSchema>
export type StartGroupSplit = z.infer<typeof startGroupSplitSchema>
