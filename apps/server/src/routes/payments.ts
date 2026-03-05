import { Hono } from "hono"
import { db } from "../db/index.js"
import { payments, bills, groups } from "../db/schema.js"
import { requireAuth } from "../lib/middleware.js"
import { eq, and } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { claimPaymentSchema } from "@pladuk/shared/schemas"

const app = new Hono()
  .use(requireAuth)


  .patch("/:id/claim", zValidator("json", claimPaymentSchema), async (c) => {
    const paymentId = c.req.param("id")
    const body = c.req.valid("json")


    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))

    if (!payment) {
        return c.json({ error: "Payment not found" }, 404)
    }

    if (payment.status !== "unpaid") {
        return c.json({
            error: `Cannot claim payment that is currently ${payment.status}`
        }, 400)
    }

    const [updatedPayment] = await db.update(payments).set({
        status: "claimed",
        claimedAt: new Date(),
        slipImageUrl: body.slipImageUrl || null,
    }).where(eq(payments.id, paymentId)).returning()

    return c.json(updatedPayment, 200)
  })

  .patch("/:id/confirm", async (c) => {
    const paymentId = c.req.param("id")
    
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
    if (!payment) {
      return c.json({error: "Payment not found"}, 404)
    }

    if (payment.status !== 'claimed') {
      return c.json({error: `Cannot confirm payment that is currently ${payment.status}`}, 400)
    }

    const [updatedPayment] = await db.update(payments).set({
      status: "confirmed",
      confirmedAt: new Date()
    }).where(eq(payments.id, paymentId)).returning()

    return c.json(updatedPayment, 200)
  })

  .patch("/:id/reject", async (c) => {
    const paymentId = c.req.param("id")

    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))

    if (!payment) {
      return c.json({ error: "payment not found" }, 404)
    }

    if (payment.status !== "claimed"){
      return c.json({ error: `Cannot reject payment that is currently ${payment.status}` }, 400)
    }

    const [updatedPayment] = await db.update(payments).set({
      status: "rejected",
      rejectedAt: new Date(),
      slipImageUrl: null
    }).where(eq(payments.id, paymentId)).returning()

    return c.json(updatedPayment, 200)
  })


export default app;