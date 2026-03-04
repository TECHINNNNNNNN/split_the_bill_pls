import { describe, it, expect } from "vitest"
import { calculateSplit } from "./calculateSplit.js"

describe("calculateSplit", () => {
  it("returns empty splits when no members", () => {
    const result = calculateSplit([], [], {
      subtotal: 0,
      vatAmount: null,
      serviceChargeAmount: null,
      totalAmount: 0,
    }, [])

    expect(result.splits).toEqual([])
    expect(result.roundingDifference).toBe(0)
  })

  it("returns zero splits when no items", () => {
    const result = calculateSplit([], [], {
      subtotal: 0,
      vatAmount: null,
      serviceChargeAmount: null,
      totalAmount: 0,
    }, ["alice", "bob"])

    expect(result.splits).toHaveLength(2)
    expect(result.splits[0].totalAmount).toBe(0)
    expect(result.splits[1].totalAmount).toBe(0)
  })

  it("splits one item equally between two members", () => {
    const items = [{ id: "item1", name: "Pizza", totalPrice: 200 }]
    const claims = [
      { billItemId: "item1", memberId: "alice" },
      { billItemId: "item1", memberId: "bob" },
    ]
    const totals = {
      subtotal: 200,
      vatAmount: null,
      serviceChargeAmount: null,
      totalAmount: 200,
    }

    const result = calculateSplit(items, claims, totals, ["alice", "bob"])

    expect(result.splits[0].totalAmount).toBe(100)
    expect(result.splits[1].totalAmount).toBe(100)
    expect(result.splits[0].items).toHaveLength(1)
    expect(result.splits[0].items[0].shareAmount).toBe(100)
  })

  it("assigns item only to the member who claimed it", () => {
    const items = [
      { id: "item1", name: "Pizza", totalPrice: 200 },
      { id: "item2", name: "Pasta", totalPrice: 150 },
    ]
    const claims = [
      { billItemId: "item1", memberId: "alice" },
      { billItemId: "item2", memberId: "bob" },
    ]
    const totals = {
      subtotal: 350,
      vatAmount: null,
      serviceChargeAmount: null,
      totalAmount: 350,
    }

    const result = calculateSplit(items, claims, totals, ["alice", "bob"])

    expect(result.splits[0].totalAmount).toBe(200)
    expect(result.splits[1].totalAmount).toBe(150)
  })

  it("distributes VAT proportionally", () => {
    const items = [
      { id: "item1", name: "Pizza", totalPrice: 300 },
      { id: "item2", name: "Salad", totalPrice: 100 },
    ]
    const claims = [
      { billItemId: "item1", memberId: "alice" },
      { billItemId: "item2", memberId: "bob" },
    ]
    const totals = {
      subtotal: 400,
      vatAmount: 28, // 7% VAT
      serviceChargeAmount: null,
      totalAmount: 428,
    }

    const result = calculateSplit(items, claims, totals, ["alice", "bob"])

    // Alice: 300/400 = 75% → VAT share = 21
    expect(result.splits[0].vatShare).toBe(21)
    expect(result.splits[0].totalAmount).toBe(321)
    // Bob gets the remainder: 428 - 321 = 107
    expect(result.splits[1].totalAmount).toBe(107)
  })

  it("distributes service charge proportionally", () => {
    const items = [{ id: "item1", name: "Steak", totalPrice: 500 }]
    const claims = [
      { billItemId: "item1", memberId: "alice" },
      { billItemId: "item1", memberId: "bob" },
    ]
    const totals = {
      subtotal: 500,
      vatAmount: null,
      serviceChargeAmount: 50, // 10% service
      totalAmount: 550,
    }

    const result = calculateSplit(items, claims, totals, ["alice", "bob"])

    expect(result.splits[0].serviceChargeShare).toBe(25)
    expect(result.splits[1].serviceChargeShare).toBe(25)
  })

  it("last person absorbs rounding remainder", () => {
    const items = [{ id: "item1", name: "Dinner", totalPrice: 100 }]
    const claims = [
      { billItemId: "item1", memberId: "a" },
      { billItemId: "item1", memberId: "b" },
      { billItemId: "item1", memberId: "c" },
    ]
    const totals = {
      subtotal: 100,
      vatAmount: null,
      serviceChargeAmount: null,
      totalAmount: 100,
    }

    const result = calculateSplit(items, claims, totals, ["a", "b", "c"])

    // 100 / 3 = 33.333... → floor to 33.33 each
    // First two: 33.33 + 33.33 = 66.66
    // Last person: 100 - 66.66 = 33.34 (absorbs remainder)
    expect(result.splits[0].totalAmount).toBe(33.33)
    expect(result.splits[1].totalAmount).toBe(33.33)
    expect(result.splits[2].totalAmount).toBe(33.34)
    expect(result.roundingDifference).toBeCloseTo(0.0066, 3)
  })

  it("skips unclaimed items", () => {
    const items = [
      { id: "item1", name: "Pizza", totalPrice: 200 },
      { id: "item2", name: "Nobody wants this", totalPrice: 100 },
    ]
    const claims = [
      { billItemId: "item1", memberId: "alice" },
    ]
    const totals = {
      subtotal: 300,
      vatAmount: null,
      serviceChargeAmount: null,
      totalAmount: 300,
    }

    const result = calculateSplit(items, claims, totals, ["alice"])

    // Alice only pays for Pizza, not the unclaimed item
    expect(result.splits[0].itemsSubtotal).toBe(200)
    expect(result.splits[0].items).toHaveLength(1)
  })
})
