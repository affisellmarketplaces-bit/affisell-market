import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { aggregateOwedLegs, owedLegsForOrder } from "@/lib/transfers/owed-without-connect"

const base = {
  orderId: "o1",
  paidAt: new Date("2026-10-01"),
  supplierId: "s1",
  affiliateId: "a1",
  supplierHasConnect: false,
  affiliateHasConnect: false,
  supplierIsPlatform: false,
  plannedSupplierCents: 1600,
  plannedAffiliateCents: 400,
  attemptRoles: [] as string[],
}

describe("money owed to partners without a Connect account (read-only)", () => {
  it("a leg is owed when the partner has no destination and no transfer row", () => {
    expect(owedLegsForOrder(base).map((l) => [l.role, l.amountCents])).toEqual([
      ["SUPPLIER", 1600],
      ["AFFILIATE", 400],
    ])
  })

  it("nothing is owed with a destination, an existing transfer row, a zero leg or the platform account", () => {
    expect(owedLegsForOrder({ ...base, supplierHasConnect: true, affiliateHasConnect: true })).toEqual([])
    expect(owedLegsForOrder({ ...base, attemptRoles: ["SUPPLIER", "AFFILIATE"] })).toEqual([])
    expect(owedLegsForOrder({ ...base, plannedSupplierCents: 0, plannedAffiliateCents: 0 })).toEqual([])
    expect(owedLegsForOrder({ ...base, supplierIsPlatform: true }).map((l) => l.role)).toEqual(["AFFILIATE"])
  })

  it("aggregates per partner, oldest payment first known, largest debt first", () => {
    const legs = [
      ...owedLegsForOrder(base),
      ...owedLegsForOrder({ ...base, orderId: "o2", paidAt: new Date("2026-09-01"), plannedSupplierCents: 900 }),
    ]
    const r = aggregateOwedLegs(legs)
    expect(r.partners[0]).toMatchObject({ role: "SUPPLIER", partnerId: "s1", orders: 2, owedCents: 2500 })
    expect(r.partners[0]!.oldestPaidAt).toBe("2026-09-01T00:00:00.000Z")
    expect(r.totalCents).toBe(3300)
  })

  it("the report module never writes or pays", () => {
    const src = readFileSync(path.resolve(__dirname, "../transfers/owed-without-connect.server.ts"), "utf8")
    expect(src).not.toMatch(/\.(create|update|upsert|delete)(Many)?\(|transfers\.create|getStripeClient/)
  })
})
