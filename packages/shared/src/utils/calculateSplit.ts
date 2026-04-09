// ─── Input Types ─────────────────────────────

export interface CalcBillItem {
  id: string
  name: string
  totalPrice: number
}

export interface CalcItemClaim {
  billItemId: string
  memberId: string
  /** Number of shares this member has of the item (default 1 = equal split). */
  share?: number
}

export interface CalcBillTotals {
  subtotal: number
  discountAmount: number | null
  vatAmount: number | null
  serviceChargeAmount: number | null
  totalAmount: number
}

// ─── Output Types ────────────────────────────

export interface MemberItemDetail {
  itemId: string
  name: string
  shareAmount: number
}

export interface MemberSplit {
  memberId: string
  itemsSubtotal: number
  proportion: number
  discountShare: number
  vatShare: number
  serviceChargeShare: number
  totalAmount: number
  items: MemberItemDetail[]
}

export interface SplitResult {
  splits: MemberSplit[]
  roundingDifference: number
}

// ─── The Algorithm (PRD Section 12) ──────────

/**
 * Calculate the bill split for all members.
 *
 * Supports weighted (ratio) splitting: if a claim has `share > 1`, that
 * member gets proportionally more of the item's cost. For example, if
 * Alice has share=2 and Bob has share=1 on a ฿300 item, Alice pays ฿200
 * and Bob pays ฿100.
 *
 * Rounding strategy:
 * - Each person's total is floored to 2 decimal places (satang)
 * - The last person in the array absorbs the remainder
 * - Rounding error is typically < ฿1
 */
export function calculateSplit(
  items: CalcBillItem[],
  claims: CalcItemClaim[],
  totals: CalcBillTotals,
  memberIds: string[],
): SplitResult {
  if (memberIds.length === 0) {
    return { splits: [], roundingDifference: 0 }
  }

  if (items.length === 0) {
    return {
      splits: memberIds.map((memberId) => ({
        memberId,
        itemsSubtotal: 0,
        proportion: 0,
        discountShare: 0,
        vatShare: 0,
        serviceChargeShare: 0,
        totalAmount: 0,
        items: [],
      })),
      roundingDifference: 0,
    }
  }

  // Build lookup: itemId → list of { memberId, share }
  const itemClaimersMap = new Map<string, { memberId: string; share: number }[]>()
  for (const claim of claims) {
    const existing = itemClaimersMap.get(claim.billItemId) || []
    existing.push({ memberId: claim.memberId, share: claim.share ?? 1 })
    itemClaimersMap.set(claim.billItemId, existing)
  }

  // Step 1: Calculate each member's item subtotal (weighted by shares)
  const memberSubtotals = new Map<string, number>()
  const memberItems = new Map<string, MemberItemDetail[]>()

  for (const memberId of memberIds) {
    memberSubtotals.set(memberId, 0)
    memberItems.set(memberId, [])
  }

  for (const item of items) {
    const claimers = itemClaimersMap.get(item.id)
    if (!claimers || claimers.length === 0) continue

    const totalShares = claimers.reduce((sum, c) => sum + c.share, 0)

    for (const claimer of claimers) {
      const shareAmount = item.totalPrice * (claimer.share / totalShares)
      memberSubtotals.set(claimer.memberId, (memberSubtotals.get(claimer.memberId) || 0) + shareAmount)
      memberItems.get(claimer.memberId)!.push({
        itemId: item.id,
        name: item.name,
        shareAmount,
      })
    }
  }

  // Step 2: Distribute discount, VAT, and service charge proportionally
  const discountAmount = totals.discountAmount ?? 0
  const vatAmount = totals.vatAmount ?? 0
  const serviceChargeAmount = totals.serviceChargeAmount ?? 0

  const splits: MemberSplit[] = []
  let runningTotal = 0

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]
    const itemsSubtotal = memberSubtotals.get(memberId) || 0
    const proportion = totals.subtotal > 0 ? itemsSubtotal / totals.subtotal : 0

    const discountShare = discountAmount * proportion
    const vatShare = vatAmount * proportion
    const serviceChargeShare = serviceChargeAmount * proportion

    let totalAmount: number

    if (i === memberIds.length - 1) {
      // Last person absorbs rounding remainder
      totalAmount = Math.max(0, totals.totalAmount - runningTotal)
    } else {
      totalAmount = Math.max(0, Math.floor((itemsSubtotal - discountShare + serviceChargeShare + vatShare) * 100) / 100)
      runningTotal += totalAmount
    }

    splits.push({
      memberId,
      itemsSubtotal,
      proportion,
      discountShare,
      vatShare,
      serviceChargeShare,
      totalAmount,
      items: memberItems.get(memberId) || [],
    })
  }

  // How much the last person absorbed beyond their "fair" share
  const last = splits[splits.length - 1]
  const lastFairTotal = (last?.itemsSubtotal ?? 0) - (last?.discountShare ?? 0) + (last?.vatShare ?? 0) + (last?.serviceChargeShare ?? 0)
  const roundingDifference = (last?.totalAmount ?? 0) - lastFairTotal

  return { splits, roundingDifference }
}
