import { describe, expect, it } from "vitest"

import { summarizeMoneyInvariants } from "@/lib/finance/money-invariants"
import {
  assertPayoutPreflightAllows,
  evaluatePayoutPreflight,
  PayoutPreflightBlockedError,
  preflightExitCode,
  REQUIRED_PREFLIGHT_CHECKS,
  finalizePreflight,
  type PreflightInput,
} from "@/lib/finance/payout-preflight"
import { gatherPayoutPreflight, stripeKeyMode, type PreflightStripe } from "@/lib/finance/payout-preflight.server"
import type { RawQueryable } from "@/lib/finance/money-invariants.server"
import { STRIPE_WEBHOOK_REQUIRED_EVENTS } from "@/lib/stripe-webhook-required-events"

const clean = (): PreflightInput => ({
  keyMode: "test",
  webhooks: [{ endpoint: "https://x/api/webhooks/stripe", enabled: true, missing: [], missingMoneyCritical: [] }],
  invariants: { summary: summarizeMoneyInvariants(12, []), violations: [] },
  duplicates: [],
  consistency: { orderTransfers: 20, unrecorded: [] },
  refunds: { checked: 3, unrecorded: [] },
  disputes: { seen: 0, decisions: [] },
  freshness: { latestChargeAt: "2026-11-27T10:00:00.000Z", latestWebhookAt: "2026-11-27T10:00:05.000Z" },
})
const statusOf = (r: ReturnType<typeof evaluatePayoutPreflight>, id: string) =>
  r.checks.find((c) => c.id === id)?.status

describe("evaluatePayoutPreflight — verdicts", () => {
  it("everything clean → PASS (exit 0), the gate allows", () => {
    const r = evaluatePayoutPreflight(clean())
    expect(r.verdict).toBe("PASS")
    expect(preflightExitCode(r)).toBe(0)
    expect(() => assertPayoutPreflightAllows(r)).not.toThrow()
  })

  it("a check that could not run is BLOCKED, never PASS (no data ≠ no problem)", () => {
    for (const k of [
      "webhooks",
      "invariants",
      "duplicates",
      "consistency",
      "refunds",
      "disputes",
      "freshness",
    ] as const) {
      const r = evaluatePayoutPreflight({ ...clean(), [k]: null, errors: { [k]: "boom" } })
      expect(r.verdict, k).toBe("BLOCKED")
    }
    expect(evaluatePayoutPreflight({ ...clean(), keyMode: null }).verdict).toBe("BLOCKED")
    expect(evaluatePayoutPreflight({ ...clean(), keyMode: "unknown" }).verdict).toBe("BLOCKED")
  })

  it("money events not subscribed → BLOCKED; only non-money events missing → WARNING; no enabled endpoint → BLOCKED", () => {
    const missingDispute = {
      endpoint: "e",
      enabled: true,
      missing: ["charge.dispute.created" as const],
      missingMoneyCritical: ["charge.dispute.created" as const],
    }
    expect(statusOf(evaluatePayoutPreflight({ ...clean(), webhooks: [missingDispute] }), "webhook_subscription")).toBe(
      "BLOCKED",
    )
    const missingAccount = {
      endpoint: "e",
      enabled: true,
      missing: ["account.updated" as const],
      missingMoneyCritical: [],
    }
    const w = evaluatePayoutPreflight({ ...clean(), webhooks: [missingAccount] })
    expect(statusOf(w, "webhook_subscription")).toBe("WARNING")
    expect(w.verdict).toBe("WARNING")
    expect(preflightExitCode(w)).toBe(1)
    expect(() => assertPayoutPreflightAllows(w)).not.toThrow() // a WARNING does not stop the cycle
    expect(
      statusOf(
        evaluatePayoutPreflight({ ...clean(), webhooks: [{ ...missingAccount, enabled: false }] }),
        "webhook_subscription",
      ),
    ).toBe("BLOCKED")
  })

  it("critical/high invariant → BLOCKED; medium/low → WARNING; nothing checked → WARNING", () => {
    const v = (severity: "critical" | "high" | "medium" | "low") => ({
      orderId: "o",
      code: "paid_more_than_payable" as const,
      severity,
      detail: "d",
    })
    for (const [sev, want] of [
      ["critical", "BLOCKED"],
      ["high", "BLOCKED"],
      ["medium", "WARNING"],
      ["low", "WARNING"],
    ] as const) {
      const r = evaluatePayoutPreflight({
        ...clean(),
        invariants: { summary: summarizeMoneyInvariants(1, [v(sev)]), violations: [v(sev)] },
      })
      expect(statusOf(r, "ledger_invariants"), sev).toBe(want)
    }
    expect(
      statusOf(
        evaluatePayoutPreflight({
          ...clean(),
          invariants: { summary: summarizeMoneyInvariants(0, []), violations: [] },
        }),
        "ledger_invariants",
      ),
    ).toBe("WARNING")
  })

  it("any Stripe duplicate → BLOCKED, with the transfer ids as evidence", () => {
    const r = evaluatePayoutPreflight({
      ...clean(),
      duplicates: [
        {
          transferGroup: "cmpjs9",
          destination: "acct",
          role: "SUPPLIER",
          transferIds: ["tr_1", "tr_2"],
          amounts: [8736, 8736],
          extraCount: 1,
          extraCents: 8736,
          firstCreated: 1,
          lastCreated: 2,
        },
      ],
    })
    expect(r.verdict).toBe("BLOCKED")
    expect(r.checks.find((c) => c.id === "stripe_duplicates")?.evidence[0]).toContain("tr_1, tr_2")
    expect(() => assertPayoutPreflightAllows(r)).toThrow(PayoutPreflightBlockedError)
  })

  it("a Stripe transfer of our order that nothing records → BLOCKED", () => {
    const r = evaluatePayoutPreflight({
      ...clean(),
      consistency: { orderTransfers: 3, unrecorded: [{ transferId: "tr_x", transferGroup: "o1", amount: 100 }] },
    })
    expect(statusOf(r, "stripe_ledger_consistency")).toBe("BLOCKED")
  })
})

describe("stripeKeyMode", () => {
  it("only reports the mode, from the prefix", () => {
    expect(stripeKeyMode("sk_test_abc")).toBe("test")
    expect(stripeKeyMode("rk_live_abc")).toBe("live")
    expect(stripeKeyMode("whsec_x")).toBe("unknown")
    expect(stripeKeyMode("")).toBeNull()
  })
})

/** Integration: the real gatherer + evaluator, with a Stripe fake and a database fake answering the real SQL. */
function iter<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const x of items) yield x
    },
  }
}

type FakeWorld = {
  orders: Array<{ id: string; charge?: string }>
  ledger?: Array<{ id: string; amount: number }>
  attempts?: Array<{ id: string; amount: number; destination: string }>
  accounts?: string[]
  clawbacks?: Array<{ orderId: string; cents: number }>
  refundsRecorded?: string[]
  holds?: Array<{ id: string; status: string }>
  lastWebhookAt?: string | null
  /** paymentRef values recorded on supplier-purchase claims; undefined = the table does not exist. */
  claimTable?: string[]
}

/** Answers the gatherer's real SQL from an in-memory world (the SQL itself runs on PostgreSQL in scripts/sql/). */
function fakeDb(w: FakeWorld): RawQueryable {
  return {
    async $queryRawUnsafe<T>(sql: string, ...v: unknown[]): Promise<T> {
      const arr = (v[0] ?? []) as string[]
      const out = (rows: unknown[]) => rows as T
      if (sql.includes('FROM "Order" o')) return out([]) // invariants loader: no order with money activity
      if (sql.startsWith('SELECT "id" FROM "Order"'))
        return out(w.orders.filter((o) => arr.includes(o.id)).map((o) => ({ id: o.id })))
      if (sql.startsWith('SELECT "id", "stripeChargeId"'))
        return out(
          w.orders.filter((o) => o.charge && arr.includes(o.charge)).map((o) => ({ id: o.id, charge: o.charge })),
        )
      if (sql.startsWith('SELECT "stripeChargeId" AS "charge"'))
        return out(w.orders.filter((o) => o.charge && arr.includes(o.charge)).map((o) => ({ charge: o.charge })))
      if (sql.includes('FROM "MerchantPayoutLedger"') && sql.includes("CLAWBACK")) return out(w.clawbacks ?? [])
      if (sql.includes('FROM "MerchantPayoutLedger"')) return out((w.ledger ?? []).filter((l) => arr.includes(l.id)))
      if (sql.includes('FROM "TransferAttempt"')) return out((w.attempts ?? []).filter((a) => arr.includes(a.id)))
      if (sql.includes('FROM "User"'))
        return out((w.accounts ?? []).filter((a) => arr.includes(a)).map((acct) => ({ acct })))
      if (sql.includes('FROM "OrderStripeRefund"'))
        return out((w.refundsRecorded ?? []).filter((r) => arr.includes(r)).map((id) => ({ id })))
      if (sql.includes("LIKE ANY")) return out(w.holds ?? [])
      if (sql.includes('max("createdAt")')) return out([{ at: w.lastWebhookAt ?? null }])
      if (sql.includes("to_regclass")) return out([{ exists: w.claimTable !== undefined }])
      if (sql.includes('FROM "SupplierPurchaseClaim"'))
        return out((w.claimTable ?? []).filter((r) => arr.includes(r)).map((ref) => ({ ref })))
      throw new Error(`unexpected SQL in test: ${sql.slice(0, 60)}`)
    },
  }
}

const failing = <T>(msg: string): AsyncIterable<T> => ({
  async *[Symbol.asyncIterator]() {
    throw new Error(msg)
  },
})

describe("gatherPayoutPreflight → evaluatePayoutPreflight (integration)", () => {
  const stripe = (
    o: {
      transfers?: Array<Record<string, unknown>>
      events?: readonly string[]
      refunds?: Array<Record<string, unknown>>
      disputes?: Array<Record<string, unknown>>
      latestCharge?: { id: string; created: number } | null
    } = {},
  ): PreflightStripe => ({
    webhookEndpoints: {
      list: () =>
        iter([
          {
            url: "https://affisell-market.vercel.app/api/webhooks/stripe",
            status: "enabled",
            enabled_events: [...(o.events ?? STRIPE_WEBHOOK_REQUIRED_EVENTS)],
          },
        ]),
    },
    transfers: { list: () => iter((o.transfers ?? []) as never[]) },
    refunds: { list: () => iter((o.refunds ?? []) as never[]) },
    disputes: { list: () => iter((o.disputes ?? []) as never[]) },
    charges: {
      list: () => iter(o.latestCharge === null ? [] : [o.latestCharge ?? { id: "ch_last", created: 1_795_000_000 }]),
    },
  })
  const tr = (id: string, group: string, dest: string, role: string, extra: Record<string, unknown> = {}) => ({
    id,
    amount: 8_736,
    created: 1,
    destination: dest,
    transfer_group: group,
    metadata: { role },
    ...extra,
  })
  const fresh = new Date(1_795_000_000 * 1000).toISOString()
  const run = async (s: PreflightStripe, w: FakeWorld) =>
    evaluatePayoutPreflight(await gatherPayoutPreflight({ stripe: s, db: fakeDb(w), keyMode: "test", sinceDays: 365 }))
  const blockedIds = (r: ReturnType<typeof evaluatePayoutPreflight>) =>
    r.checks
      .filter((c) => c.status === "BLOCKED")
      .map((c) => c.id)
      .sort()

  it("the 24/05 Test data: duplicates + unrecorded transfers + 2-event webhook → BLOCKED", async () => {
    const r = await run(
      stripe({
        transfers: [
          tr("tr_1a", "cmpjs9", "acct_sup", "supplier"),
          tr("tr_1b", "cmpjs9", "acct_sup", "supplier"),
          tr("tr_3e", "cmpjs9", "acct_sup", "SUPPLIER"),
        ],
        events: ["payment_intent.succeeded", "checkout.session.completed"],
      }),
      {
        orders: [{ id: "cmpjs9" }],
        attempts: [{ id: "tr_3e", amount: 8_736, destination: "acct_sup" }],
        accounts: ["acct_sup"],
        lastWebhookAt: fresh,
      },
    )
    expect(r.verdict).toBe("BLOCKED")
    expect(blockedIds(r)).toEqual(["stripe_duplicates", "stripe_ledger_consistency", "webhook_subscription"])
    expect(r.checks.find((c) => c.id === "stripe_ledger_consistency")?.summary).toContain("2 unrecorded")
  })

  it("healthy data → no BLOCKED check (empty invariant window = WARNING only)", async () => {
    const r = await run(stripe({ transfers: [tr("tr_ok", "o1", "acct_sup", "SUPPLIER")] }), {
      orders: [{ id: "o1" }],
      ledger: [{ id: "tr_ok", amount: 8_736 }],
      attempts: [{ id: "tr_ok", amount: 8_736, destination: "acct_sup" }],
      accounts: ["acct_sup"],
      lastWebhookAt: fresh,
    })
    expect(blockedIds(r)).toEqual([])
    expect(r.verdict).toBe("WARNING")
  })

  it("recorded but with a different amount or destination → BLOCKED", async () => {
    const r = await run(stripe({ transfers: [tr("tr_x", "o1", "acct_other", "SUPPLIER")] }), {
      orders: [{ id: "o1" }],
      attempts: [{ id: "tr_x", amount: 5_000, destination: "acct_sup" }],
      accounts: ["acct_sup", "acct_other"],
      lastWebhookAt: fresh,
    })
    const c = r.checks.find((x) => x.id === "stripe_ledger_consistency")!
    expect(c.status).toBe("BLOCKED")
    expect(c.evidence.join(" ")).toMatch(/amount mismatch tr_x.*destination mismatch tr_x/)
  })

  it("money sent to an account that is not ours → BLOCKED (beneficiary check)", async () => {
    const r = await run(stripe({ transfers: [tr("tr_y", "o1", "acct_stranger", "SUPPLIER")] }), {
      orders: [{ id: "o1" }],
      attempts: [{ id: "tr_y", amount: 8_736, destination: "acct_stranger" }],
      accounts: ["acct_sup"],
      lastWebhookAt: fresh,
    })
    expect(r.checks.find((x) => x.id === "stripe_ledger_consistency")?.evidence[0]).toContain("unknown destination")
  })

  it("a reversal without a CLAWBACK row → WARNING, not PASS", async () => {
    const r = await run(stripe({ transfers: [tr("tr_r", "o1", "acct_sup", "SUPPLIER", { amount_reversed: 2_000 })] }), {
      orders: [{ id: "o1" }],
      attempts: [{ id: "tr_r", amount: 8_736, destination: "acct_sup" }],
      accounts: ["acct_sup"],
      lastWebhookAt: fresh,
    })
    expect(r.checks.find((x) => x.id === "stripe_ledger_consistency")?.status).toBe("WARNING")
  })

  it("supplier payments: one purchase paid twice, or paid outside the lock → BLOCKED; recorded once → PASS", async () => {
    const sup = (id: string, token: string, extra: Record<string, unknown> = {}) => ({
      id,
      amount: 1_000,
      created: 1,
      destination: "acct_sup",
      transfer_group: null,
      metadata: { purchaseClaimToken: token, providerId: "p" },
      ...extra,
    })
    const w = { orders: [], lastWebhookAt: fresh }
    const twice = await run(stripe({ transfers: [sup("tr_s1", "tok_a"), sup("tr_s2", "tok_a")] }), {
      ...w,
      claimTable: ["tr_s1"],
    })
    const c1 = twice.checks.find((x) => x.id === "stripe_ledger_consistency")!
    expect(c1.status).toBe("BLOCKED")
    expect(c1.evidence.join(" ")).toContain("paid twice (claim tok_a): tr_s1, tr_s2")
    const reversedSecond = await run(
      stripe({ transfers: [sup("tr_s1", "tok_a"), sup("tr_s2", "tok_a", { amount_reversed: 1_000 })] }),
      {
        ...w,
        claimTable: ["tr_s1"],
      },
    )
    expect(reversedSecond.checks.find((x) => x.id === "stripe_ledger_consistency")?.status).toBe("PASS")
    const noTable = await run(stripe({ transfers: [sup("tr_s3", "tok_b")] }), w)
    expect(noTable.checks.find((x) => x.id === "stripe_ledger_consistency")?.evidence.join(" ")).toContain(
      "claim table missing",
    )
    const outside = await run(stripe({ transfers: [sup("tr_s5", "tok_d")] }), { ...w, claimTable: ["tr_other"] })
    const c2 = outside.checks.find((x) => x.id === "stripe_ledger_consistency")!
    expect(c2.status).toBe("BLOCKED")
    expect(c2.evidence.join(" ")).toContain("tr_s5 (claim tok_d): not recorded on its claim")
    const ok = await run(stripe({ transfers: [sup("tr_s4", "tok_c")] }), { ...w, claimTable: ["tr_s4"] })
    expect(ok.checks.find((x) => x.id === "stripe_ledger_consistency")?.status).toBe("PASS")
  })

  it("a Stripe refund the platform never recorded (missed charge.refunded) → BLOCKED", async () => {
    const r = await run(
      stripe({
        refunds: [
          { id: "re_1", amount: 500, charge: "ch_o1", status: "succeeded" },
          { id: "re_2", amount: 300, charge: "ch_o1", status: "succeeded" },
          { id: "re_x", amount: 900, charge: "ch_not_ours", status: "succeeded" },
          { id: "re_f", amount: 100, charge: "ch_o1", status: "failed" },
        ],
      }),
      { orders: [{ id: "o1", charge: "ch_o1" }], refundsRecorded: ["re_1"], lastWebhookAt: fresh },
    )
    const c = r.checks.find((x) => x.id === "stripe_refunds_recorded")!
    expect(c.status).toBe("BLOCKED")
    expect(c.evidence).toEqual(["re_2 (o1, 300)"])
  })

  it("an open Stripe dispute without its D7 hold (missed charge.dispute.created) → BLOCKED", async () => {
    const r = await run(stripe({ disputes: [{ id: "dp_1", status: "needs_response", charge: "ch_o1" }] }), {
      orders: [{ id: "o1", charge: "ch_o1" }],
      holds: [],
      lastWebhookAt: fresh,
    })
    expect(r.checks.find((x) => x.id === "dispute_holds")).toMatchObject({ status: "BLOCKED" })
  })

  it("webhooks no longer arriving (charges newer than the last webhook) → BLOCKED", async () => {
    const r = await run(stripe(), {
      orders: [],
      lastWebhookAt: new Date(1_795_000_000 * 1000 - 3 * 3_600_000).toISOString(),
    })
    expect(r.checks.find((x) => x.id === "webhook_freshness")?.status).toBe("BLOCKED")
    const never = await run(stripe(), { orders: [], lastWebhookAt: null })
    expect(never.checks.find((x) => x.id === "webhook_freshness")?.status).toBe("BLOCKED")
    const quiet = await run(stripe({ latestCharge: null }), { orders: [], lastWebhookAt: null })
    expect(quiet.checks.find((x) => x.id === "webhook_freshness")?.status).toBe("PASS")
  })

  it("an error in the MIDDLE of a pagination is a failed read, never a partial list judged as complete", async () => {
    const s = stripe()
    s.refunds = { list: () => failing("connection reset on page 3") }
    s.transfers = { list: () => failing("rate limited") }
    const r = await run(s, { orders: [], lastWebhookAt: fresh })
    expect(r.checks.find((x) => x.id === "stripe_refunds_recorded")).toMatchObject({
      status: "BLOCKED",
      evidence: ["connection reset on page 3"],
    })
    expect(r.checks.find((x) => x.id === "stripe_duplicates")?.status).toBe("BLOCKED")
    expect(r.checks.find((x) => x.id === "stripe_ledger_consistency")?.status).toBe("BLOCKED")
  })

  it("no Stripe key and no database → every check BLOCKED, never PASS", async () => {
    const r = evaluatePayoutPreflight(
      await gatherPayoutPreflight({ stripe: null, db: null, keyMode: null, sinceDays: 30 }),
    )
    expect(r.checks.every((c) => c.status === "BLOCKED")).toBe(true)
  })
})

describe("the future gate (not wired)", () => {
  const now = new Date("2026-11-28T00:00:00Z")
  const pass = evaluatePayoutPreflight(clean(), now)

  it("a fresh PASS allows; a WARNING allows", () => {
    expect(pass.verdict).toBe("PASS")
    expect(() => assertPayoutPreflightAllows(pass, { now })).not.toThrow()
    const warn = evaluatePayoutPreflight(
      { ...clean(), invariants: { summary: summarizeMoneyInvariants(0, []), violations: [] } },
      now,
    )
    expect(warn.verdict).toBe("WARNING")
    expect(() => assertPayoutPreflightAllows(warn, { now })).not.toThrow()
  })

  it("stale, from the future, missing, malformed or incomplete results are refused", () => {
    expect(() => assertPayoutPreflightAllows(pass, { now: new Date(now.getTime() + 16 * 60_000) })).toThrow(
      PayoutPreflightBlockedError,
    )
    expect(() => assertPayoutPreflightAllows(pass, { now: new Date(now.getTime() - 5 * 60_000) })).toThrow(
      PayoutPreflightBlockedError,
    )
    expect(() => assertPayoutPreflightAllows(null, { now })).toThrow(PayoutPreflightBlockedError)
    expect(() => assertPayoutPreflightAllows({ ...pass, generatedAt: "not a date" }, { now })).toThrow(
      PayoutPreflightBlockedError,
    )
    expect(() => assertPayoutPreflightAllows({ ...pass, checks: pass.checks.slice(1) }, { now })).toThrow(
      PayoutPreflightBlockedError,
    )
  })

  it("a tampered verdict cannot hide a BLOCKED check", () => {
    const blocked = evaluatePayoutPreflight({ ...clean(), duplicates: null }, now)
    expect(() => assertPayoutPreflightAllows({ ...blocked, verdict: "PASS" }, { now })).toThrow(
      PayoutPreflightBlockedError,
    )
  })

  it("the evaluator itself never returns PASS without every required check", () => {
    expect(pass.checks.map((c) => c.id).sort()).toEqual([...REQUIRED_PREFLIGHT_CHECKS].sort())
    const partial = pass.checks.filter((c) => c.id !== "stripe_refunds_recorded")
    expect(finalizePreflight(partial, now).verdict).toBe("BLOCKED")
    expect(finalizePreflight([...pass.checks, pass.checks[0]!], now).verdict).toBe("BLOCKED")
  })
})
