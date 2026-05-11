import { describe, it, expect } from "vitest"
import { finalizeRoomSchema } from "./bill.js"

const memberA = "11111111-1111-1111-1111-111111111111"
const memberB = "22222222-2222-2222-2222-222222222222"

describe("finalizeRoomSchema — memberShares preservation", () => {
  // Regression: memberShares used to be silently stripped by Zod because it
  // wasn't declared on billItemSchema. That made every share multiplier
  // collapse to 1 on finalize, so the preview and finalized totals diverged.

  it("preserves memberShares on flat items[] payload", () => {
    const parsed = finalizeRoomSchema.parse({
      items: [{
        name: "Steak",
        quantity: 1,
        unitPrice: 1000,
        memberIds: [memberA, memberB],
        memberShares: { [memberA]: 3, [memberB]: 1 },
      }],
    })

    expect(parsed.items?.[0].memberShares).toEqual({ [memberA]: 3, [memberB]: 1 })
  })

  it("preserves memberShares on sections[].items[] payload", () => {
    const parsed = finalizeRoomSchema.parse({
      sections: [{
        name: "Dinner",
        items: [{
          name: "Wine",
          quantity: 1,
          unitPrice: 500,
          memberIds: [memberA, memberB],
          memberShares: { [memberA]: 2, [memberB]: 1 },
        }],
      }],
    })

    expect(parsed.sections?.[0].items[0].memberShares).toEqual({ [memberA]: 2, [memberB]: 1 })
  })

  it("allows memberShares to be omitted (legacy clients sending only memberIds)", () => {
    const parsed = finalizeRoomSchema.parse({
      items: [{
        name: "Rice",
        quantity: 1,
        unitPrice: 100,
        memberIds: [memberA, memberB],
      }],
    })

    expect(parsed.items?.[0].memberShares).toBeUndefined()
    expect(parsed.items?.[0].memberIds).toEqual([memberA, memberB])
  })

  it("rejects share values less than 1", () => {
    expect(() => finalizeRoomSchema.parse({
      items: [{
        name: "Bad",
        quantity: 1,
        unitPrice: 100,
        memberIds: [memberA],
        memberShares: { [memberA]: 0 },
      }],
    })).toThrow()
  })

  it("rejects non-integer share values", () => {
    expect(() => finalizeRoomSchema.parse({
      items: [{
        name: "Bad",
        quantity: 1,
        unitPrice: 100,
        memberIds: [memberA],
        memberShares: { [memberA]: 1.5 },
      }],
    })).toThrow()
  })
})
