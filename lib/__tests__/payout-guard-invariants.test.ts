import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Money-path INVARIANTS — the guards each payout rail must run before money leaves, in order.
 *
 * The protections of #13 (Lightning A3), #26 (payable after refunds) and #28 (D7, Stripe check, lease) were built in
 * separate branches and meet in the same functions. A future conflict resolution can drop one of them while every
 * behavioural test still passes (each test mocks the guards it does not exercise). This test reads the real sources and
 * fails if a guard disappears, moves AFTER the Stripe transfer call, or if a rail gains a second transfer call that would
 * bypass them. It pins structure, not behaviour: the behaviour is proved by the money tests of each PR.
 */
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8")

/** Index of each marker; every one must exist and appear in the given order, all BEFORE `before`. */
function expectOrderedBefore(code: string, markers: string[], before: string) {
  const end = code.indexOf(before)
  expect(end, `missing ${before}`).toBeGreaterThan(-1)
  let last = -1
  for (const m of markers) {
    const at = code.indexOf(m, last + 1)
    expect(at, `guard missing or out of order: ${m}`).toBeGreaterThan(last)
    expect(at, `guard after the transfer call: ${m}`).toBeLessThan(end)
    last = at
  }
}

describe("payout rails keep every guard before money leaves", () => {
  it("Connect (process-transfers): #13 → #26 → #28 guards, in order, before the only transfers.create", () => {
    const code = src("lib/transfers/process-transfers.ts")
    expect(code.split("stripe.transfers.create(").length - 1, "exactly one transfer call").toBe(1)
    expectOrderedBefore(
      code,
      [
        'reason: "already_paid_via_lightning"', // Lightning already paid this order
        'reason: "lightning_processing"', // #13: Lightning in flight / in doubt
        "isOrderClosedForPayout(attempt.order)", // #26: refunded / cancelled
        "isOrderPayoutHeldForDispute(attempt.order", // #28 D7: open dispute
        "evaluateTransferReleaseForRole(", // delivery / return gates
        "TRANSFER_LEASE_MS", // #28: one run per attempt (lease claim)
        "checkTransferBudget(", // never more than the line
        "isOrderClosedForPayout(fresh)", // #26: late re-read
        "isOrderPayoutHeldForDispute(fresh", // #28: dispute opened meanwhile
        "verifyReleaseWithStripe(", // #28: Stripe agrees with our rows
        "payableAfterRefunds(", // #26: the single rule for what is owed
        "stripe.transfers.list(", // #26: adopt a transfer a lost call created
        "lastAttemptAt: leaseNow", // #28: fencing — still our lease
      ],
      "stripe.transfers.create(",
    )
    // The amount sent is the payable amount, never the scheduled share.
    expect(code).toMatch(/transfers\.create\(\s*\{\s*amount: payableCents,/)
    // A failure never overwrites a SUCCESS (#13 and #28 both rely on it).
    expect(code).toMatch(
      /updateMany\(\{\s*where: \{ id: attempt\.id, status: "PENDING" \},\s*data: \{\s*status: terminal/,
    )
    // Refunds that landed during the call are clawed back after the record.
    expect(code.indexOf("clawBackRefundsDuringTransfer(attempt.orderId")).toBeGreaterThan(
      code.indexOf("stripe.transfers.create("),
    )
  })

  it("Lightning: locked by default (#13), refuses closed and disputed orders (#28) before any transfer", () => {
    const code = src("lib/stripe-lightning.ts")
    expectOrderedBefore(
      code,
      ["isLightningLocked()", "isOrderClosedForPayout(order)", "isOrderPayoutHeldForDispute(order"],
      "stripe.transfers.create(",
    )
  })

  it("Légion override: refuses closed and disputed orders before its transfer", () => {
    const code = src("lib/legion/pay-referral-override.ts")
    expectOrderedBefore(
      code,
      ["isOrderClosedForPayout(order)", "isOrderPayoutHeldForDispute(order"],
      "stripe.transfers.create(",
    )
  })

  it("the webhook replays failed events (D2) and routes disputes (D7)", () => {
    const code = src("lib/stripe-webhook-processor.ts")
    expect(code).toContain("isDuplicateWebhookRecord(")
    expect(code).toContain("isReplayableWebhookRecord(")
    expect(code).toContain('case "charge.dispute.closed":')
  })

  it("the dispute decision is taken on Stripe's LIVE dispute, under the per-(dispute, order) lock", () => {
    const code = src("lib/stripe-dispute.ts")
    expect(code).toContain("disputes.retrieve(disputeId)")
    expect(code).not.toContain("readDisputeHold(tx")
    expect(code.split("lockDisputeHold(tx").length - 1).toBeGreaterThanOrEqual(4)
  })
})
