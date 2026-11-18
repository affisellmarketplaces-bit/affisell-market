import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { planOrderResume, resolveOwedResumeMode, summarizeResume, type ResumeOrderFacts } from "@/lib/transfers/owed-resume"

const order = (o: Partial<ResumeOrderFacts> = {}): ResumeOrderFacts => ({
  orderId: "o1",
  paidAt: new Date("2026-10-01T00:00:00Z"),
  closed: false,
  disputeOpen: false,
  refundedCents: 0,
  supplierIsPlatform: false,
  legs: [
    { role: "SUPPLIER", partnerId: "s1", plannedCents: 800, destination: "acct_s", hasAttempt: false },
    { role: "AFFILIATE", partnerId: "a1", plannedCents: 150, destination: null, hasAttempt: false },
  ],
  ...o,
})

describe("planOrderResume — never a double payment, never a guess", () => {
  it("creates only a leg whose partner now has an account and that has no transfer row at all", () => {
    const plans = planOrderResume(order())
    expect(plans.map((p) => [p.role, p.decision, p.amountCents])).toEqual([
      ["SUPPLIER", "create", 800],
      ["AFFILIATE", "still_no_connect", 150],
    ])
    expect(plans[0]!.idempotencyKey).toBe("owed-resume:o1:SUPPLIER")
  })
  it("any existing attempt (even failed or reversed) blocks the leg", () => {
    const o = order({ legs: [{ role: "SUPPLIER", partnerId: "s1", plannedCents: 800, destination: "acct_s", hasAttempt: true }] })
    expect(planOrderResume(o)[0]!.decision).toBe("already_scheduled")
  })
  it("closed, disputed and partially refunded orders are never resumed automatically", () => {
    expect(planOrderResume(order({ closed: true }))[0]!.decision).toBe("order_closed")
    expect(planOrderResume(order({ disputeOpen: true }))[0]!.decision).toBe("dispute_open")
    expect(planOrderResume(order({ refundedCents: 100 }))[0]!.decision).toBe("partially_refunded")
  })
  it("a leg already paid by another rail, or to an account not ready for transfers, is never created", () => {
    const paid = order({ legs: [{ role: "SUPPLIER", partnerId: "s1", plannedCents: 800, destination: "acct_s", hasAttempt: false, paidElsewhere: true }] })
    expect(planOrderResume(paid)[0]!.decision).toBe("paid_elsewhere")
    const notReady = order({ legs: [{ role: "SUPPLIER", partnerId: "s1", plannedCents: 800, destination: "acct_s", hasAttempt: false, destinationNotReady: true }] })
    expect(planOrderResume(notReady)[0]!.decision).toBe("account_not_ready")
    // an existing attempt (even FAILED after a cron error) wins over every other reason: never duplicated
    const failed = order({ legs: [{ role: "SUPPLIER", partnerId: "s1", plannedCents: 800, destination: "acct_s", hasAttempt: true, paidElsewhere: true }] })
    expect(planOrderResume(failed)[0]!.decision).toBe("already_scheduled")
  })

  it("the platform auto-buy account is never owed; a zero leg owes nothing", () => {
    expect(planOrderResume(order({ supplierIsPlatform: true }))[0]!.decision).toBe("platform_account")
    const z = order({ legs: [{ role: "SUPPLIER", partnerId: "s1", plannedCents: 0, destination: "acct_s", hasAttempt: false }] })
    expect(planOrderResume(z)[0]!.decision).toBe("nothing_owed")
  })
  it("summary counts the resumable money by partner", () => {
    const s = summarizeResume([...planOrderResume(order()), ...planOrderResume(order({ orderId: "o2" }))])
    expect(s.resumable).toEqual({ legs: 2, cents: 1600, partners: 1 })
    expect(s.byDecision.still_no_connect).toEqual({ legs: 2, cents: 300 })
  })
})

describe("applying is OFF unless the founder switches it on", () => {
  it("only the exact word enforce enables it", () => {
    expect(resolveOwedResumeMode({})).toBe("off")
    expect(resolveOwedResumeMode({ OWED_TRANSFER_RESUME_MODE: "true" })).toBe("off")
    expect(resolveOwedResumeMode({ OWED_TRANSFER_RESUME_MODE: "enforce" })).toBe("enforce")
  })
  it("the apply path checks the mode first, re-plans under a row lock, never calls Stripe", () => {
    const src = readFileSync("lib/transfers/owed-resume.server.ts", "utf8")
    const apply = src.slice(src.indexOf("export async function applyOwedTransferResume"))
    expect(apply.indexOf('resolveOwedResumeMode() !== "enforce"')).toBeLessThan(apply.indexOf("$transaction"))
    expect(apply).toContain("FOR UPDATE")
    expect(apply).toContain("skipDuplicates: true")
    expect(src).not.toContain('from "@/lib/stripe"')
    expect(src).not.toMatch(/transfers\.create|stripe\.transfers/)
  })
})
