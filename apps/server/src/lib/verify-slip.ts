/**
 * Slip verification helper — swappable provider.
 *
 * Sends QR data (or transRef+sendingBank) to a third-party API that queries
 * bank records and returns the actual transaction amount. Returns null on any
 * failure so callers can gracefully fall back to manual host verification.
 */

export interface SlipVerifyResult {
  amount: number
  senderName?: string
  receiverName?: string
}

export interface SlipVerifyInput {
  qrData?: string       // raw QR string from slip (preferred for SlipOK)
  transRef?: string
  sendingBank?: string
}

export async function verifySlip(input: SlipVerifyInput): Promise<SlipVerifyResult | null> {
  const apiKey = process.env.SLIP_VERIFY_API_KEY
  if (!apiKey) return null

  const provider = process.env.SLIP_VERIFY_PROVIDER ?? "slipok"

  try {
    switch (provider) {
      case "slipok":
        return await verifyViaSlipOK(input, apiKey)
      case "openslipverify":
        return await verifyViaOpenSlipVerify(input, apiKey)
      default:
        return null
    }
  } catch {
    // Verification failure is non-blocking — host can still confirm manually
    return null
  }
}

// ─── SlipOK ─────────────────────────────────

async function verifyViaSlipOK(
  input: SlipVerifyInput,
  apiKey: string,
): Promise<SlipVerifyResult | null> {
  const branchId = process.env.SLIP_VERIFY_BRANCH_ID
  if (!branchId || !input.qrData) return null

  const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-authorization": apiKey,
    },
    body: JSON.stringify({ data: input.qrData }),
  })

  // SlipOK returns 400 for invalid slips but still includes data in some cases
  const body = await res.json() as SlipOKResponse

  if (body.data?.amount == null) return null

  return {
    amount: body.data.amount,
    senderName: body.data.sender?.displayName ?? body.data.sender?.name,
    receiverName: body.data.receiver?.displayName ?? body.data.receiver?.name,
  }
}

interface SlipOKResponse {
  success?: boolean
  code?: number
  message?: string
  data: {
    amount: number
    transRef?: string
    sendingBank?: string
    receivingBank?: string
    transDate?: string
    transTime?: string
    sender?: { displayName?: string; name?: string }
    receiver?: { displayName?: string; name?: string }
  }
}

// ─── OpenSlipVerify (legacy) ────────────────

async function verifyViaOpenSlipVerify(
  input: SlipVerifyInput,
  apiKey: string,
): Promise<SlipVerifyResult | null> {
  if (!input.transRef || !input.sendingBank) return null

  const res = await fetch("https://api.openslipverify.com/api/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      transRef: input.transRef,
      sendingBank: input.sendingBank,
    }),
  })

  if (!res.ok) return null

  const result = await res.json() as {
    data?: {
      amount?: number
      sender?: { name?: string }
      receiver?: { name?: string }
    }
  }

  if (result.data?.amount == null) return null

  return {
    amount: result.data.amount,
    senderName: result.data.sender?.name,
    receiverName: result.data.receiver?.name,
  }
}
