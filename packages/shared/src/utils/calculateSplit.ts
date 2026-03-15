// ─── Input Types ─────────────────────────────

export interface CalcBillItem {
  id: string
  name: string
  totalPrice: number
}

export interface CalcItemClaim {
  billItemId: string
  memberId: string
}

export interface CalcBillTotals {
  subtotal: number
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
        vatShare: 0,
        serviceChargeShare: 0,
        totalAmount: 0,
        items: [],
      })),
      roundingDifference: 0,
    }
  }

  // Build lookup: itemId → list of claimer memberIds
  const itemClaimersMap = new Map<string, string[]>()
  for (const claim of claims) {
    const existing = itemClaimersMap.get(claim.billItemId) || []
    existing.push(claim.memberId)
    itemClaimersMap.set(claim.billItemId, existing)
  }

  // Step 1: Calculate each member's item subtotal
  const memberSubtotals = new Map<string, number>()
  const memberItems = new Map<string, MemberItemDetail[]>()

  for (const memberId of memberIds) {
    memberSubtotals.set(memberId, 0)
    memberItems.set(memberId, [])
  }

  for (const item of items) {
    const claimerIds = itemClaimersMap.get(item.id)
    if (!claimerIds || claimerIds.length === 0) continue

    const sharePerPerson = item.totalPrice / claimerIds.length

    for (const memberId of claimerIds) {
      memberSubtotals.set(memberId, (memberSubtotals.get(memberId) || 0) + sharePerPerson)
      memberItems.get(memberId)!.push({
        itemId: item.id,
        name: item.name,
        shareAmount: sharePerPerson,
      })
    }
  }

  // Step 2: Distribute VAT and service charge proportionally
  const vatAmount = totals.vatAmount ?? 0
  const serviceChargeAmount = totals.serviceChargeAmount ?? 0

  const splits: MemberSplit[] = []
  let runningTotal = 0

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]
    const itemsSubtotal = memberSubtotals.get(memberId) || 0
    const proportion = totals.subtotal > 0 ? itemsSubtotal / totals.subtotal : 0

    const vatShare = vatAmount * proportion
    const serviceChargeShare = serviceChargeAmount * proportion

    let totalAmount: number

    if (i === memberIds.length - 1) {
      // Last person absorbs rounding remainder
      totalAmount = totals.totalAmount - runningTotal
    } else {
      totalAmount = Math.floor((itemsSubtotal + vatShare + serviceChargeShare) * 100) / 100
      runningTotal += totalAmount
    }

    splits.push({
      memberId,
      itemsSubtotal,
      proportion,
      vatShare,
      serviceChargeShare,
      totalAmount,
      items: memberItems.get(memberId) || [],
    })
  }

  // How much the last person absorbed beyond their "fair" share
  const last = splits[splits.length - 1]
  const lastFairTotal = (last?.itemsSubtotal ?? 0) + (last?.vatShare ?? 0) + (last?.serviceChargeShare ?? 0)
  const roundingDifference = (last?.totalAmount ?? 0) - lastFairTotal

  return { splits, roundingDifference }
}
