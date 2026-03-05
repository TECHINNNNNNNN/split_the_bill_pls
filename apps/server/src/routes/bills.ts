import { Hono } from "hono"
import { db } from "../db/index.js"
import { bills, billItems, itemClaims, groups, payments, groupMembers } from "../db/schema.js"
import { requireAuth } from "../lib/middleware.js"
import { eq, and } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { createBillSchema, setClaimsSchema } from "@pladuk/shared/schemas"
import { calculateSplit } from "@pladuk/shared/utils"
import { randomUUID } from "node:crypto"

const app = new Hono()

  .use(requireAuth)

  // ─── POST /bills ─────────────────────────────
  // Create a new bill with items in one request.
  // This is a "transaction" — the bill AND all its items
  // get inserted together. If any item fails, nothing is saved.
  //
  // The request body looks like:
  // {
  //   groupId: "...",
  //   name: "Dinner at MK",
  //   subtotal: 400,
  //   vatAmount: 28,
  //   totalAmount: 428,
  //   items: [
  //     { name: "Sukiyaki", quantity: 1, unitPrice: 200, totalPrice: 200 },
  //     { name: "Tom Yum", quantity: 1, unitPrice: 200, totalPrice: 200 },
  //   ]
  // }
  .post("/", zValidator("json", createBillSchema), async (c) => {
    const user = c.get("user")
    const data = c.req.valid("json")

    // Verify the user owns this group
    const group = await db.query.groups.findFirst({
      where: and(eq(groups.id, data.groupId), eq(groups.createdBy, user.id)),
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    // Generate a unique share token for the public bill link
    // This is what makes the URL: pladuk.online/bill/abc12345
    const shareToken = randomUUID().slice(0, 8)

    // Insert the bill
    const [bill] = await db.insert(bills).values({
      id: randomUUID(),
      groupId: data.groupId,
      paidBy: user.id,
      name: data.name,
      subtotal: data.subtotal.toString(),
      vatRate: data.vatRate?.toString() ?? null,
      vatAmount: data.vatAmount?.toString() ?? null,
      serviceChargeRate: data.serviceChargeRate?.toString() ?? null,
      serviceChargeAmount: data.serviceChargeAmount?.toString() ?? null,
      totalAmount: data.totalAmount.toString(),
      receiptImageUrl: data.receiptImageUrl ?? null,
      shareToken,
      status: "active",
    }).returning()

    // Insert all items for this bill
    const insertedItems = await db.insert(billItems).values(
      data.items.map((item, index) => ({
        id: randomUUID(),
        billId: bill.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
        sortOrder: item.sortOrder ?? index,
      }))
    ).returning()

    return c.json({ ...bill, items: insertedItems }, 201)
  })

  // ─── GET /bills/:id ──────────────────────────
  // Get a bill with all its items, claims, and payments.
  // This is the "full bill view" — everything the payer needs to see.
  .get("/:id", async (c) => {
    const user = c.get("user")
    const billId = c.req.param("id")

    const bill = await db.query.bills.findFirst({
      where: eq(bills.id, billId),
      with: {
        items: {
          with: {
            claims: {
              with: {
                member: true,  // include member name for each claim
              },
            },
          },
        },
        payments: {
          with: {
            member: true,  // include member name for each payment
          },
        },
        group: {
          with: {
            members: true,  // include all group members
          },
        },
      },
    })

    if (!bill) {
      return c.json({ error: "Bill not found" }, 404)
    }

    // Only the group creator can see the bill via this route
    // (friends see it via the public share link — different route later)
    if (bill.group.createdBy !== user.id) {
      return c.json({ error: "Unauthorized" }, 403)
    }

    return c.json(bill)
  })

  // ─── POST /bills/:id/claims ──────────────────
  // Set who claimed which items on a bill.
  // This REPLACES all existing claims (delete + re-insert).
  // Why? Because the UI lets you tap items to assign people.
  // Every time you change assignments, the full claim set is sent.
  //
  // After setting claims, we run calculateSplit to figure out
  // how much each person owes, then create/update payment records.
  .post("/:id/claims", zValidator("json", setClaimsSchema), async (c) => {
    const user = c.get("user")
    const billId = c.req.param("id")
    const { claims } = c.req.valid("json")

    // Get the bill with items and group members
    const bill = await db.query.bills.findFirst({
      where: eq(bills.id, billId),
      with: {
        items: true,
        group: {
          with: {
            members: true,
          },
        },
      },
    })

    if (!bill) {
      return c.json({ error: "Bill not found" }, 404)
    }

    if (bill.group.createdBy !== user.id) {
      return c.json({ error: "Unauthorized" }, 403)
    }

    // Step 1: Delete all existing claims for this bill's items
    for (const item of bill.items) {
      await db.delete(itemClaims).where(eq(itemClaims.billItemId, item.id))
    }

    // Step 2: Run the calculation engine to get each person's share
    // This is the calculateSplit function we wrote and tested!
    const calcItems = bill.items.map((item) => ({
      id: item.id,
      name: item.name,
      totalPrice: parseFloat(item.totalPrice),
    }))

    const calcClaims = claims.map((claim) => ({
      billItemId: claim.billItemId,
      memberId: claim.memberId,
    }))

    const totals = {
      subtotal: parseFloat(bill.subtotal),
      vatAmount: bill.vatAmount ? parseFloat(bill.vatAmount) : null,
      serviceChargeAmount: bill.serviceChargeAmount
        ? parseFloat(bill.serviceChargeAmount)
        : null,
      totalAmount: parseFloat(bill.totalAmount),
    }

    // Get unique member IDs from the claims
    const memberIds = [...new Set(claims.map((c) => c.memberId))]

    const splitResult = calculateSplit(calcItems, calcClaims, totals, memberIds)

    // Step 3: Insert new claims with calculated share amounts
    const newClaims = await db.insert(itemClaims).values(
      claims.map((claim) => {
        // Find this member's split to get the item share amount
        const memberSplit = splitResult.splits.find(
          (s) => s.memberId === claim.memberId
        )
        const itemDetail = memberSplit?.items.find(
          (i) => i.itemId === claim.billItemId
        )

        return {
          id: randomUUID(),
          billItemId: claim.billItemId,
          memberId: claim.memberId,
          shareAmount: (itemDetail?.shareAmount ?? 0).toFixed(2),
        }
      })
    ).returning()

    // Step 4: Delete old payment records and create new ones
    // based on calculated totals per person
    await db.delete(payments).where(eq(payments.billId, billId))

    const newPayments = await db.insert(payments).values(
      splitResult.splits.map((split) => ({
        id: randomUUID(),
        billId,
        memberId: split.memberId,
        amount: split.totalAmount.toFixed(2),
        status: "unpaid" as const,
      }))
    ).returning()

    return c.json({
      claims: newClaims,
      payments: newPayments,
      splits: splitResult.splits,
    })
  })

export default app
