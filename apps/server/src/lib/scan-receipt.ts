// ─── Receipt OCR via Qwen Vision API ───
// Uses the OpenAI-compatible chat completions format.
// Provider-agnostic: works with DashScope, Together AI, or any
// OpenAI-compatible endpoint serving Qwen VL models.

export interface ScannedItem {
  name: string
  quantity: number
  unitPrice: number
}

export interface ScanReceiptResult {
  items: ScannedItem[]
  vatRate: number | null          // e.g. 0.07 for 7%
  serviceChargeRate: number | null // e.g. 0.10 for 10%
  discountAmount: number | null    // flat amount in local currency
}

const SYSTEM_PROMPT = `You extract structured data from restaurant/food receipt images. Return ONLY valid JSON.

Output format:
{
  "items": [{ "name": "Item name", "quantity": 1, "unitPrice": 123.45 }],
  "taxPct": null,
  "serviceChargePct": null,
  "discountAmount": null
}

ITEMS — what to INCLUDE:
- Food, drinks, and product line items only.
- If quantity is shown (e.g. "2x Cola 25"), return quantity: 2, unitPrice: 25 (the per-unit price, NOT the total).
- If quantity is NOT shown, use quantity: 1.
- If the receipt shows a total price for multiple items (e.g. "Cola x2  50"), divide to get the unit price: quantity: 2, unitPrice: 25.
- Include real charges like container fees, cover charges, corkage, packaging fees.
- Combo/set items: use the total combo price as one item.
- Sub-descriptions (e.g. "Shrimp", "Chicken", "Beef" below an item) are modifiers, NOT separate items. Merge them into the parent item name (e.g. "Yellow Curry (D) - Shrimp").

ITEMS — what to EXCLUDE (never add these as items):
- Subtotal, Total, Grand Total, Net, ยอดรวม, 合計, 소계
- Tax/VAT/GST lines (any language)
- Service charge lines (any language)
- Discounts, promos, coupons (negative amounts)
- Rounding adjustments (tiny amounts like ±0.01–0.05)
- Payment info: Cash, Credit Card, Change, PromptPay, Visa, etc.
- Metadata: Table No., Date, Cashier, Receipt No., Tax ID, etc.

TAX ("taxPct"):
This covers ALL types of tax — VAT, Tax, Sales Tax, GST, MwSt, TVA, IVA, ภาษีมูลค่าเพิ่ม, 消費税, CGST/SGST, SST, etc.
- If a percentage is printed (e.g. "VAT 7%"), use that number → taxPct: 7
- If only a tax AMOUNT is shown (e.g. "Tax: 5.84" with subtotal 69.12), CALCULATE with 2 decimal precision: 5.84 / 69.12 × 100 = 8.45 → taxPct: 8.45
- IMPORTANT: Do NOT round to whole numbers. Use up to 2 decimal places for accuracy (e.g. 8.45, not 8).
- If no tax line exists at all → taxPct: null
- If multiple tax lines exist (e.g. CGST + SGST), sum them into one taxPct.
- NOTE: The subtotal for tax calculation is AFTER discount (if any). If items sum to 76.80 and discount is 7.68, subtotal = 69.12.

SERVICE CHARGE ("serviceChargePct"):
Covers: Service Charge, SC, S/C, Gratuity, Auto Gratuity, ค่าบริการ, サービス料, Servizio, etc.
- If a percentage is printed, use it → serviceChargePct: 10
- If only an amount is shown, CALCULATE from subtotal with 2 decimal precision → amount / subtotal × 100 (e.g. 6.91 / 69.12 × 100 = 10.00)
- IMPORTANT: Do NOT round to whole numbers. Use up to 2 decimal places.
- If no service charge line exists → serviceChargePct: null
- Do NOT count tips written by hand or suggested tip amounts.

DISCOUNT ("discountAmount"):
Covers: Discount, ส่วนลด, Promo, Promotion, Coupon, Member Discount, Happy Hour, FOC, etc.
- Use the TOTAL discount amount as a positive number (e.g. receipt shows "-50" or "Disc 50" → discountAmount: 50).
- If only a percentage is shown (e.g. "10% off" with no amount), CALCULATE: round(sum of items × percentage / 100, 2 decimals).
- If both a percentage and an amount are shown, use the printed amount.
- If multiple discount lines exist, sum them.
- If no discount line exists → discountAmount: null

If you cannot read the receipt or it's not a receipt image, return:
{ "items": [], "taxPct": null, "serviceChargePct": null, "discountAmount": null }

Return ONLY the JSON. No markdown fences, no explanation.`

export async function scanReceipt(imageBase64: string): Promise<ScanReceiptResult> {
  const apiKey = process.env.QWEN_API_KEY
  const baseUrl = process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  const model = process.env.QWEN_MODEL || "qwen-vl-max"

  if (!apiKey) {
    throw new Error("QWEN_API_KEY is not configured")
  }

  // Strip data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "")

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Data}` },
            },
            {
              type: "text",
              text: "Extract all line items, tax, service charge, and discount from this receipt.",
            },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Qwen API error (${response.status}): ${errorText}`)
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const raw = body.choices?.[0]?.message?.content?.trim()
  if (!raw) {
    throw new Error("Empty response from Qwen API")
  }

  console.log("[scan-receipt] Raw Qwen response:", raw)

  // Parse JSON — handle potential markdown code fences
  const jsonStr = raw.replace(/^```json?\s*/, "").replace(/\s*```$/, "")

  let parsed: {
    items?: unknown[]
    taxPct?: number | null
    serviceChargePct?: number | null
    discountAmount?: number | null
  }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`Failed to parse Qwen response as JSON: ${jsonStr.slice(0, 200)}`)
  }

  // Validate and normalize
  const items: ScannedItem[] = []
  if (Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      const entry = item as Record<string, unknown>
      const name = typeof entry.name === "string" ? entry.name.trim() : ""
      const qty = typeof entry.quantity === "number" && entry.quantity >= 1 ? Math.floor(entry.quantity) : 1
      // Support both "unitPrice" and legacy "amount" from the AI response
      const rawPrice = entry.unitPrice ?? entry.amount
      const unitPrice = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice))
      if (name && !isNaN(unitPrice) && unitPrice > 0) {
        items.push({ name, quantity: qty, unitPrice })
      }
    }
  }

  const taxPct = typeof parsed.taxPct === "number" ? parsed.taxPct : null
  const scPct = typeof parsed.serviceChargePct === "number" ? parsed.serviceChargePct : null
  const discountAmt = typeof parsed.discountAmount === "number" && parsed.discountAmount > 0
    ? parsed.discountAmount
    : null

  return {
    items,
    vatRate: taxPct != null ? taxPct / 100 : null,
    serviceChargeRate: scPct != null ? scPct / 100 : null,
    discountAmount: discountAmt,
  }
}
