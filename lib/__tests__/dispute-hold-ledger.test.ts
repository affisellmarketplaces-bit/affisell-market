import { describe, expect, it } from "vitest"

import { createFakeProcessedWebhook, type FakeProcessedWebhookRow } from "@/lib/testing/fake-processed-webhook"
import {
  closeDisputeHold,
  disputeHoldId,
  DISPUTE_HOLD_ID_PREFIX,
  DISPUTE_HOLD_STATUS,
  hasOpenDisputeHold,
  openDisputeHold,
  readDisputeHold,
} from "@/lib/orders/dispute-hold.server"

/** `processedWebhook` delegate backed by memory: just what the ledger uses. */
function fakeDb(initial: FakeProcessedWebhookRow[] = []) {
  const { delegate, rows } = createFakeProcessedWebhook(initial)
  return { db: { processedWebhook: delegate } as never, rows }
}

describe("dispute hold ledger", () => {
  it("ids can never collide with a Stripe event id and carry both the dispute and the order", () => {
    expect(disputeHoldId("dp_1", "ord_1")).toBe("dispute:dp_1:ord_1")
    expect(disputeHoldId("dp_1", "ord_1").startsWith("evt_")).toBe(false)
    expect(DISPUTE_HOLD_ID_PREFIX).toBe("dispute:")
  })

  it("statuses are never 'success' or 'failed' (stripe-health and the replay job must ignore them)", () => {
    for (const status of Object.values(DISPUTE_HOLD_STATUS)) {
      expect(status).not.toBe("success")
      expect(status).not.toBe("failed")
      expect(status.startsWith("dispute_")).toBe(true)
    }
  })

  it("opens a hold once, remembers the previous status, and is idempotent", async () => {
    const { db, rows } = fakeDb()
    expect(await hasOpenDisputeHold("ord_1", db)).toBe(false)

    expect(await openDisputeHold(db, { disputeId: "dp_1", orderId: "ord_1", previousStatus: "shipped" })).toBe("created")
    expect(await hasOpenDisputeHold("ord_1", db)).toBe(true)
    expect(await hasOpenDisputeHold("ord_other", db)).toBe(false)
    expect(await readDisputeHold(db, "dp_1", "ord_1")).toEqual({ status: "dispute_open", previousStatus: "shipped" })

    // second call: same row, the remembered status is NOT overwritten by the (now "disputed") current one
    expect(await openDisputeHold(db, { disputeId: "dp_1", orderId: "ord_1", previousStatus: "disputed" })).toBe("already_open")
    expect(rows.size).toBe(1)
    expect((await readDisputeHold(db, "dp_1", "ord_1"))?.previousStatus).toBe("shipped")
  })

  it("a closed hold is never reopened (a late `created` replayed after `closed`)", async () => {
    const { db } = fakeDb()
    await openDisputeHold(db, { disputeId: "dp_1", orderId: "ord_1", previousStatus: "paid" })
    await closeDisputeHold(db, { disputeId: "dp_1", orderId: "ord_1", outcome: "won" })
    expect(await hasOpenDisputeHold("ord_1", db)).toBe(false)

    expect(await openDisputeHold(db, { disputeId: "dp_1", orderId: "ord_1", previousStatus: "paid" })).toBe("already_closed")
    expect(await hasOpenDisputeHold("ord_1", db)).toBe(false)
    expect((await readDisputeHold(db, "dp_1", "ord_1"))?.status).toBe("dispute_won")
  })

  it("closing without a prior row (closing event first) records the terminal outcome, and never rewrites a terminal one", async () => {
    const { db } = fakeDb()
    await closeDisputeHold(db, { disputeId: "dp_9", orderId: "ord_9", outcome: "lost" })
    expect((await readDisputeHold(db, "dp_9", "ord_9"))?.status).toBe("dispute_lost")
    await closeDisputeHold(db, { disputeId: "dp_9", orderId: "ord_9", outcome: "won" })
    expect((await readDisputeHold(db, "dp_9", "ord_9"))?.status).toBe("dispute_lost")
  })

  it("'another dispute still open?' ignores the dispute that is closing", async () => {
    const { db } = fakeDb()
    await openDisputeHold(db, { disputeId: "dp_1", orderId: "ord_1", previousStatus: "paid" })
    expect(await hasOpenDisputeHold("ord_1", db, { exceptDisputeId: "dp_1" })).toBe(false)
    await openDisputeHold(db, { disputeId: "dp_2", orderId: "ord_1", previousStatus: "paid" })
    expect(await hasOpenDisputeHold("ord_1", db, { exceptDisputeId: "dp_1" })).toBe(true)
  })

  it("never mistakes an ordinary webhook row of the same order for a dispute hold", async () => {
    const { db } = fakeDb([{ id: "evt_1", orderId: "ord_1", status: "dispute_open", error: null }])
    expect(await hasOpenDisputeHold("ord_1", db)).toBe(false)
  })

  it("a database error propagates: the caller must not release money on 'could not read the ledger'", async () => {
    const db = {
      processedWebhook: {
        count: async () => {
          throw new Error("db down")
        },
      },
    } as never
    await expect(hasOpenDisputeHold("ord_1", db)).rejects.toThrow("db down")
  })

  it("tolerates a corrupted remembered-status note", async () => {
    const { db } = fakeDb([{ id: "dispute:dp_1:ord_1", orderId: "ord_1", status: "dispute_open", error: "not json" }])
    expect(await readDisputeHold(db, "dp_1", "ord_1")).toEqual({ status: "dispute_open", previousStatus: null })
  })
})
