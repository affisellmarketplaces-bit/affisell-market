/**
 * Sentinel collectors for the AliExpress purchase gate:
 *  - a claim orphaned by a crash / timeout (BUYING for too long) is detected by the existing `sentinel-scan` cron, P0, idempotent;
 *  - a margin refusal is a decision, not a failure: it has its own code and NO "retry" playbook.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>>, rows: [] as Array<Record<string, unknown>> }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fulfillmentLog: {
      findMany: async (args: Record<string, unknown>) => {
        h.calls.push(args)
        return h.rows
      },
    },
  },
}))

import { collectFulfillmentFailedSignals } from "@/lib/sentinel/collectors/fulfillment-failed"
import { collectPurchaseInDoubtSignals } from "@/lib/sentinel/collectors/purchase-in-doubt"
import { sentinelSignalId } from "@/lib/sentinel/signal-id"

const NOW = new Date("2026-11-13T12:00:00Z")

beforeEach(() => {
  h.calls.length = 0
  h.rows = []
})

describe("collectPurchaseInDoubtSignals", () => {
  it("asks for BUYING logs older than 15 minutes only (a fresh claim is a normal in-flight purchase)", async () => {
    await collectPurchaseInDoubtSignals(NOW)
    const where = h.calls[0]!.where as { status: string; updatedAt: { lt: Date } }
    expect(where.status).toBe("BUYING")
    expect(where.updatedAt.lt.toISOString()).toBe("2026-11-13T11:45:00.000Z")
  })

  it("turns each orphaned claim into ONE P0 signal on the order, with the reconciliation steps", async () => {
    h.rows = [{ id: "log1", orderId: "o1", attempts: 1, updatedAt: new Date("2026-11-13T09:00:00Z"), errorMsg: null }]
    const [s] = await collectPurchaseInDoubtSignals(NOW)
    expect(s).toMatchObject({
      severity: "P0",
      domain: "fulfillment",
      code: "fulfillment.purchase_in_doubt",
      entityType: "order",
      entityId: "o1",
      playbook: "open-order",
    })
    expect(s!.detail).toContain("AliExpress order list")
    expect(s!.detail).toContain("Order.supplierOrderId")
  })

  it("is idempotent: the same order is the same signal id (one row, one new-P0 alert)", async () => {
    h.rows = [{ id: "log1", orderId: "o1", attempts: 1, updatedAt: new Date("2026-11-13T09:00:00Z"), errorMsg: null }]
    const [a] = await collectPurchaseInDoubtSignals(NOW)
    const [b] = await collectPurchaseInDoubtSignals(new Date(NOW.getTime() + 3_600_000))
    expect(sentinelSignalId(a!)).toBe(sentinelSignalId(b!))
  })

  it("no stale claim => no signal (the signal closes by itself once the log leaves BUYING)", async () => {
    expect(await collectPurchaseInDoubtSignals(NOW)).toEqual([])
  })
})

describe("collectFulfillmentFailedSignals — margin refusals (#6)", () => {
  const row = (errorMsg: string | null) => ({
    id: "log1",
    orderId: "o1",
    attempts: 0,
    errorMsg,
    order: { id: "o1", customerEmail: "x@example.test", product: { name: "Lamp" } },
  })

  it("a margin refusal has its own code, points at the ORDER, and offers NO retry playbook", async () => {
    h.rows = [row("MARGIN_REFUSED:margin_below_floor:margin=-636:floor=300")]
    const [s] = await collectFulfillmentFailedSignals()
    expect(s).toMatchObject({
      code: "fulfillment.margin_refused",
      entityType: "order",
      entityId: "o1",
      playbook: "open-order",
    })
    expect(s!.detail).toContain("margin=-636")
  })

  it("an ordinary failure keeps the retry playbook on the log (unchanged)", async () => {
    h.rows = [row("INVENTORY_SHORTAGE")]
    const [s] = await collectFulfillmentFailedSignals()
    expect(s).toMatchObject({ code: "fulfillment.autobuy_failed", entityType: "fulfillmentLog", entityId: "log1", playbook: "retry-auto-buy" })
  })
})
