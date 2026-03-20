export type PaymentStatus = "unpaid" | "claimed" | "confirmed" | "rejected";

// Status badge colors and labels
export const statusConfig: Record<PaymentStatus, { label: string; classes: string }> = {
  unpaid: { label: "Unpaid", classes: "border-gray-300 text-gray-500" },
  claimed: { label: "Claimed", classes: "border-yellow-300 bg-yellow-50 text-yellow-700" },
  confirmed: { label: "Confirmed", classes: "border-green-200 bg-green-50 text-green-700" },
  rejected: { label: "Rejected", classes: "border-red-200 bg-red-50 text-red-600" },
};

// Thai bank codes → display names
export const bankNames: Record<string, string> = {
  "002": "BBL",
  "004": "KBANK",
  "006": "KTB",
  "011": "TMBThanachart",
  "014": "SCB",
  "025": "KKP",
  "030": "GSB",
  "069": "KMA",
  "022": "CIMBT",
  "024": "UOB",
  "034": "BAAC",
  "066": "ISBT",
  "065": "TISCO",
  "073": "LH Bank",
};
