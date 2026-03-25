// ─── Voice-to-Bill: audio → Whisper transcription → LLM structured parsing ───
// Pattern from: https://github.com/TECHINNNNNNNN/syntaxvoice

import { experimental_transcribe as transcribe } from "ai"
import { openai } from "@ai-sdk/openai"
import type { ScannedItem } from "./scan-receipt"

export interface VoiceParseResult {
  items: ScannedItem[]
  vatRate: number | null
  serviceChargeRate: number | null
  discountAmount: number | null
  discountPct: number | null
}

const TRANSCRIPTION_MODEL = process.env.TRANSCRIPTION_MODEL || "whisper-1"

const VOICE_PROMPT = `You extract structured data from a spoken description of a restaurant order or meal. The input is a transcript that may be in Thai, English, or mixed. Return ONLY valid JSON.

Output format:
{
  "items": [{ "name": "Item name", "quantity": 1, "unitPrice": 123.45 }],
  "taxPct": null,
  "serviceChargePct": null,
  "discountAmount": null,
  "discountPct": null
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

DISCOUNT ("discountAmount" or "discountPct"):
- If a flat amount: "discount 50 baht" or "ส่วนลด 50" → discountAmount: 50, discountPct: null
- If a percentage: "10% discount" or "ลด 10%" → discountPct: 10, discountAmount: null
- If both are mentioned, prefer the flat amount.
- If no discount mentioned → discountAmount: null, discountPct: null

If the transcript contains no recognizable food items or prices, return:
{ "items": [], "taxPct": null, "serviceChargePct": null, "discountAmount": null, "discountPct": null }

Return ONLY the JSON. No markdown fences, no explanation.`

// ─── Step 1: Whisper transcription (audio buffer → text) ───

const WHISPER_PROMPT = `Thai restaurant food ordering. Common terms: som tam, pad thai, khao pad, tom yum, khao moo yang, khao moo daeng, green curry, massaman, papaya salad, sticky rice, mango sticky rice, pad see ew, pad kra pao, larb, nam tok, som tam, gai yang, baht, VAT, service charge, discount, ส่วนลด, ค่าบริการ, ภาษี`

async function transcribeAudio(audioBuffer: Uint8Array): Promise<string> {
  const result = await transcribe({
    model: openai.transcription(TRANSCRIPTION_MODEL),
    audio: audioBuffer,
    providerOptions: {
      openai: { prompt: WHISPER_PROMPT },
    },
  })

  if (!result.text?.trim()) {
    throw new Error("Whisper returned empty transcript")
  }

  return result.text.trim()
}

// ─── Step 2: LLM structured parsing (text → items JSON) ───

async function callTextModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  transcript: string,
  timeoutMs: number,
): Promise<VoiceParseResult> {
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
      discountPct?: number | null
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
    let discountAmt = typeof parsed.discountAmount === "number" && parsed.discountAmount > 0
      ? parsed.discountAmount
      : null

    // If discount was given as percentage, calculate flat amount from items subtotal
    if (discountAmt == null && typeof parsed.discountPct === "number" && parsed.discountPct > 0) {
      const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
      if (subtotal > 0) {
        discountAmt = Math.round(subtotal * parsed.discountPct / 100 * 100) / 100
      }
    }

    const discountPctValue = typeof parsed.discountPct === "number" && parsed.discountPct > 0
      ? parsed.discountPct
      : null

    return {
      items,
      vatRate: taxPct != null ? taxPct / 100 : null,
      serviceChargeRate: scPct != null ? scPct / 100 : null,
      discountAmount: discountAmt,
      discountPct: discountPctValue,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function parseTranscript(transcript: string): Promise<VoiceParseResult> {
  const qwenKey = process.env.QWEN_API_KEY
  const qwenBaseUrl = process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  const qwenModel = process.env.QWEN_TEXT_MODEL || "qwen-max"

  if (qwenKey) {
    try {
      return await callTextModel(qwenBaseUrl, qwenKey, qwenModel, transcript, 30_000)
    } catch (err) {
      console.warn("[parse-voice] Qwen failed, attempting fallback to OpenAI:", err instanceof Error ? err.message : err)
    }
  }

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

// ─── Exported: full pipeline (audio → transcript → structured items) ───

export async function parseVoiceAudio(
  audioBuffer: Uint8Array,
): Promise<VoiceParseResult & { transcript: string }> {
  const transcript = await transcribeAudio(audioBuffer)
  console.log("[parse-voice] Whisper transcript:", transcript)

  const result = await parseTranscript(transcript)
  return { ...result, transcript }
}
