import { z } from "zod"

// ─── Enums ───────────────────────────────────

export const paymentStatusSchema = z.enum(["unpaid", "claimed", "confirmed", "rejected"])
export const billStatusSchema = z.enum(["draft", "active", "settled"])
export const promptpayTypeSchema = z.enum(["phone", "national_id"])

export type PaymentStatus = z.infer<typeof paymentStatusSchema>
export type BillStatus = z.infer<typeof billStatusSchema>
export type PromptpayType = z.infer<typeof promptpayTypeSchema>

// ─── Group Schemas ───────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
})

export const addGroupMemberSchema = z.object({
  displayName: z.string().min(1).max(100),
  userId: z.string().nullable().optional(),
  isGuest: z.boolean().default(true),
})

// ─── Bill Schemas ────────────────────────────

export const billItemInputSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  sortOrder: z.number().int().default(0),
})

export const createBillSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(1).max(200),
  subtotal: z.number().nonnegative(),
  vatRate: z.number().min(0).max(1).nullable().optional(),
  vatAmount: z.number().nonnegative().nullable().optional(),
  serviceChargeRate: z.number().min(0).max(1).nullable().optional(),
  serviceChargeAmount: z.number().nonnegative().nullable().optional(),
  totalAmount: z.number().positive(),
  receiptImageUrl: z.string().url().nullable().optional(),
  items: z.array(billItemInputSchema).min(1),
})

// ─── Item Claim Schemas ──────────────────────

export const setClaimsSchema = z.object({
  claims: z.array(z.object({
    billItemId: z.string().uuid(),
    memberId: z.string().uuid(),
  })).min(1),
})

// ─── Payment Schemas ─────────────────────────

export const claimPaymentSchema = z.object({
  slipImageUrl: z.string().url().optional(),
})

// ─── Profile Schemas ─────────────────────────

export const updatePromptpaySchema = z.object({
  promptpayId: z.string().min(10).max(13),
  promptpayType: promptpayTypeSchema,
})

// ─── Derived Types ───────────────────────────

export type CreateGroup = z.infer<typeof createGroupSchema>
export type AddGroupMember = z.infer<typeof addGroupMemberSchema>
export type BillItemInput = z.infer<typeof billItemInputSchema>
export type CreateBill = z.infer<typeof createBillSchema>
export type SetClaims = z.infer<typeof setClaimsSchema>
export type ClaimPayment = z.infer<typeof claimPaymentSchema>
export type UpdatePromptpay = z.infer<typeof updatePromptpaySchema>
