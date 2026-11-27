import { describe, expect, it } from "vitest"

import { summarizeMoneyInvariants } from "@/lib/finance/money-invariants"
import {
  assertPayoutPreflightAllows,
  evaluatePayoutPreflight,
  PayoutPreflightBlockedError,
  preflightExitCode,
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
    for (const k of ["webhooks", "invariants", "duplicates", "consistency"] as const) {
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

describe("gatherPayoutPreflight → evaluatePayoutPreflight (integration)", () => {
  const stripe = (
    transfers: Array<Record<string, unknown>>,
    events: readonly string[] = STRIPE_WEBHOOK_REQUIRED_EVENTS,
  ): PreflightStripe => ({
    webhookEndpoints: {
      list: () =>
        iter([
          {
            url: "https://affisell-market.vercel.app/api/webhooks/stripe",
            status: "enabled",
            enabled_events: [...events],
          },
        ]),
    },
    transfers: { list: () => iter(transfers as never[]) },
  })
  const db = (orders: string[], recorded: string[]): RawQueryable => ({
    async $queryRawUnsafe<T>(sql: string): Promise<T> {
      if (sql.includes('FROM "Order" o')) return [] as T // invariants loader: no order with activity
      if (sql.startsWith('SELECT "id" FROM "Order"')) return orders.map((id) => ({ id })) as T
      if (sql.includes("UNION")) return recorded.map((id) => ({ id })) as T
      return [] as T
    },
  })
  const tr = (id: string, group: string, dest: string, role: string) => ({
    id,
    amount: 8_736,
    created: 1,
    destination: dest,
    transfer_group: group,
    metadata: { role },
  })

  it("the 24/05 Test data: duplicates + unrecorded transfers + 2-event webhook → BLOCKED on three checks", async () => {
    const input = await gatherPayoutPreflight({
      stripe: stripe(
        [
          tr("tr_1a", "cmpjs9", "acct_sup", "supplier"),
          tr("tr_1b", "cmpjs9", "acct_sup", "supplier"),
          tr("tr_3e", "cmpjs9", "acct_sup", "SUPPLIER"),
        ],
        ["payment_intent.succeeded", "checkout.session.completed"],
      ),
      db: db(["cmpjs9"], ["tr_3e"]),
      keyMode: "test",
      sinceDays: 365,
    })
    const r = evaluatePayoutPreflight(input)
    expect(r.verdict).toBe("BLOCKED")
    expect(
      r.checks
        .filter((c) => c.status === "BLOCKED")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["stripe_duplicates", "stripe_ledger_consistency", "webhook_subscription"])
    expect(r.checks.find((c) => c.id === "stripe_ledger_consistency")?.summary).toContain("2 of 3")
  })

  it("healthy data → no BLOCKED check (empty window = WARNING on the ledger only)", async () => {
    const input = await gatherPayoutPreflight({
      stripe: stripe([tr("tr_ok", "o1", "acct_sup", "SUPPLIER")]),
      db: db(["o1"], ["tr_ok"]),
      keyMode: "test",
      sinceDays: 30,
    })
    const r = evaluatePayoutPreflight(input)
    expect(r.checks.filter((c) => c.status === "BLOCKED")).toEqual([])
    expect(r.verdict).toBe("WARNING")
  })

  it("Stripe failing mid-way and no database → every dependent check BLOCKED with the error", async () => {
    const broken: PreflightStripe = {
      webhookEndpoints: { list: () => iter([]) },
      transfers: {
        list: () => ({
          async *[Symbol.asyncIterator]() {
            throw new Error("stripe down")
          },
        }),
      },
    }
    const r = evaluatePayoutPreflight(
      await gatherPayoutPreflight({ stripe: broken, db: null, keyMode: "test", sinceDays: 30 }),
    )
    expect(r.verdict).toBe("BLOCKED")
    expect(r.checks.find((c) => c.id === "stripe_duplicates")?.evidence).toEqual(["stripe down"])
    expect(r.checks.find((c) => c.id === "ledger_invariants")?.evidence).toEqual(["no database URL"])
  })
})
