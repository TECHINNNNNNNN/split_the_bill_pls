// ─── Voice-to-Bill: parse spoken transcript into structured bill items ───
// Uses the same Qwen/OpenAI fallback pattern as scan-receipt.ts

import type { ScanReceiptResult, ScannedItem } from "./scan-receipt"

const VOICE_PROMPT = `You extract structured data from a spoken description of a restaurant order or meal. The input is a transcript that may be in Thai, English, or mixed. Return ONLY valid JSON.

Output format:
{
  "items": [{ "name": "Item name", "quantity": 1, "unitPrice": 123.45 }],
  "taxPct": null,
  "serviceChargePct": null,
  "discountAmount": null
}

ITEMS:
- Extract food, drinks, and product items mentioned.
- "2 beers at 60 each" or "เบียร์ 2 แก้ว แก้วละ 60" → quantity: 2, unitPrice: 60
- "pizza for 300" or "พิซซ่า 300 บาท" → quantity: 1, unitPrice: 300
- "ส้มตำ 80" → quantity: 1, unitPrice: 80
- If no quantity mentioned, use quantity: 1.
- If only a total is given for multiple items (e.g. "3 cokes for 75"), divide: quantity: 3, unitPrice: 25.
- Ignore filler words, story context, timestamps, and non-order information.
- Include real charges like container fees, cover charges, corkage.

TAX ("taxPct"):
- "VAT 7%" or "แวท 7 เปอร์เซ็นต์" or "ภาษี 7%" → taxPct: 7
- If a tax amount is mentioned with a context to calculate percentage, calculate it.
- If no tax mentioned → taxPct: null

SERVICE CHARGE ("serviceChargePct"):
- "service charge 10%" or "ค่าบริการ 10%" or "SC 10%" → serviceChargePct: 10
- If no service charge mentioned → serviceChargePct: null

DISCOUNT ("discountAmount"):
- "discount 50 baht" or "ส่วนลด 50" or "ลด 50" → discountAmount: 50
- If a percentage discount is mentioned (e.g. "ลด 10%"), calculate from context if possible.
- If no discount mentioned → discountAmount: null

If the transcript contains no recognizable food items or prices, return:
{ "items": [], "taxPct": null, "serviceChargePct": null, "discountAmount": null }

Return ONLY the JSON. No markdown fences, no explanation.`

async function callTextModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  transcript: string,
  timeoutMs: number,
): Promise<ScanReceiptResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: VOICE_PROMPT },
          { role: "user", content: transcript },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Text model error (${response.status}): ${errorText}`)
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const raw = body.choices?.[0]?.message?.content?.trim()
    if (!raw) {
      throw new Error("Empty response from text model")
    }

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
      throw new Error(`Failed to parse text model response as JSON: ${jsonStr.slice(0, 200)}`)
    }

    const items: ScannedItem[] = []
    if (Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        const entry = item as Record<string, unknown>
        const name = typeof entry.name === "string" ? entry.name.trim() : ""
        const qty = typeof entry.quantity === "number" && entry.quantity >= 1 ? Math.floor(entry.quantity) : 1
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
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function parseVoiceTranscript(transcript: string): Promise<ScanReceiptResult> {
  const qwenKey = process.env.QWEN_API_KEY
  const qwenBaseUrl = process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  const qwenModel = process.env.QWEN_TEXT_MODEL || "qwen-max"

  // Try Qwen first with 30s timeout
  if (qwenKey) {
    try {
      return await callTextModel(qwenBaseUrl, qwenKey, qwenModel, transcript, 30_000)
    } catch (err) {
      console.warn("[parse-voice] Qwen failed, attempting fallback to OpenAI:", err instanceof Error ? err.message : err)
    }
  }

  // Fallback to OpenAI with 25s timeout
  const openAiKey = process.env.OPENAI_API_KEY
  if (!openAiKey) {
    throw new Error(
      qwenKey
        ? "Qwen failed and OPENAI_API_KEY is not configured"
        : "Neither QWEN_API_KEY nor OPENAI_API_KEY is configured"
    )
  }

  return await callTextModel("https://api.openai.com/v1", openAiKey, "gpt-4o-mini", transcript, 25_000)
}
