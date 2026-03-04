export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB"
    }).format(amount)
}

export { calculateSplit } from "./calculateSplit.js"
export type {
    CalcBillItem,
    CalcItemClaim,
    CalcBillTotals,
    MemberSplit,
    MemberItemDetail,
    SplitResult,
} from "./calculateSplit.js"