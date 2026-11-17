import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { formatReport } from "@/lib/strategic-intelligence/fee-reconciliation"
import {
  pickReconciliationKey,
  READ_OPERATIONS,
  readOnlyPrismaClient,
  runFeeReconciliation,
  type DbFacts,
  type RunDeps,
  type RunOptions,
} from "@/lib/strategic-intelligence/fee-reconciliation-run"

const SECRETS = ["cs_live_PLANTEDSESSION", "ch_PLANTEDCHARGE", "pi_PLANTEDINTENT", "ic_PLANTEDCARD", "order_PLANTEDID", "8123456789012345", "ENCRYPTED_TOKEN_PLANTED"]
const facts = (): DbFacts => ({
  groups: [
    { key: SECRETS[0]!, orders: [{ id: SECRETS[4]!, chargedCents: 3600 }, { id: "o2", chargedCents: 2400 }], chargeIds: [SECRETS[1]!], paymentIntentIds: [SECRETS[2]!] },
    { key: "cs_b", orders: [{ id: "o3", chargedCents: 1000 }], chargeIds: [], paymentIntentIds: ["pi_x"] },
  ],
  cards: [{ cardId: SECRETS[3]!, estimateCents: 2000 }],
  aeOrders: [{ supplierOrderId: SECRETS[5]!, estimateCents: 1500 }, { supplierOrderId: "900000001", estimateCents: 900 }, { supplierOrderId: "900000001", estimateCents: 900 }],
  aeTokenRow: { accessTokenEncrypted: SECRETS[6]!, accessExpiresAt: new Date("2027-01-01") },
})
const opts = (over: Partial<RunOptions> = {}): RunOptions => ({ days: 30, limit: 200, execute: false, issuing: false, ae: false, allowPaymentIntentRead: false, now: new Date("2026-11-17T12:00:00Z"), ...over })
const deps = () => {
  const reader = {
    balanceTxsOfCharge: vi.fn(async () => ({ kind: "read" as const, txs: [{ type: "charge", amount: 6000, fee: 115, currency: "eur" }] })),
    latestChargeOfIntent: vi.fn(async () => ({ chargeId: "ch_other" })),
    issuingTransactionsOfCard: vi.fn(async () => ({ ok: true as const, txs: [{ amount: -2100, currency: "eur", type: "capture" }] })),
  }
  return {
    reader,
    d: {
      readFacts: vi.fn(async () => facts()),
      stripeReader: vi.fn(() => reader),
      aeOrderAmounts: vi.fn(async (rows: DbFacts["aeOrders"]) => rows.map((r) => ({ path: "api" as const, status: "constate" as const, reason: "ok", estimateCents: r.estimateCents, actualCents: 1600 }))),
    } satisfies RunDeps,
  }
}

let fetchSpy: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchSpy = vi.fn(() => {
    throw new Error("network_not_allowed_in_test")
  })
  vi.stubGlobal("fetch", fetchSpy)
})
afterEach(() => vi.unstubAllGlobals())

describe("PLAN mode (the default) touches nothing but the database", () => {
  it("no key, no Stripe client, no AliExpress call, no token read, no network", async () => {
    const { d } = deps()
    const report = await runFeeReconciliation(opts(), d)
    expect(d.readFacts).toHaveBeenCalledWith(expect.objectContaining({ readAeToken: false, limit: 200 }))
    expect(d.stripeReader).not.toHaveBeenCalled()
    expect(d.aeOrderAmounts).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(report.mode).toBe("plan")
    expect(report.stripe.byStatus.estime).toEqual({ lecture_non_lancee: 1 })
    expect(report.stripe.byStatus.non_rapproche).toEqual({}) // the payment-intent-only one is "estimé" too: nothing read
    expect(report.readScope.join("\n")).toMatch(/non lancé \(mode plan\)/)
  })

  it("even with --issuing / --ae / --allow-payment-intent-read, nothing external runs without --execute", async () => {
    const { d } = deps()
    await runFeeReconciliation(opts({ issuing: true, ae: true, allowPaymentIntentRead: true }), d)
    expect(d.stripeReader).not.toHaveBeenCalled()
    expect(d.aeOrderAmounts).not.toHaveBeenCalled()
    expect(d.readFacts).toHaveBeenCalledWith(expect.objectContaining({ readAeToken: false }))
  })

  it("the printed text and the JSON carry no planted identifier, card, token or order id", async () => {
    const { d } = deps()
    for (const o of [opts(), opts({ execute: true, issuing: true, ae: true, allowPaymentIntentRead: true })]) {
      const report = await runFeeReconciliation(o, d)
      const out = formatReport(report) + JSON.stringify(report)
      for (const s of SECRETS) expect(out).not.toContain(s)
    }
  })
})

describe("EXECUTE mode reads only what was asked", () => {
  it("--execute alone: balance reads only; no payment-intent read, no Issuing, no AliExpress, no token", async () => {
    const { d, reader } = deps()
    const report = await runFeeReconciliation(opts({ execute: true }), d)
    expect(reader.balanceTxsOfCharge).toHaveBeenCalledTimes(1)
    expect(reader.latestChargeOfIntent).not.toHaveBeenCalled()
    expect(reader.issuingTransactionsOfCard).not.toHaveBeenCalled()
    expect(d.aeOrderAmounts).not.toHaveBeenCalled()
    expect(d.readFacts).toHaveBeenCalledWith(expect.objectContaining({ readAeToken: false }))
    expect(report.stripe.byStatus.constate).toEqual({ ok: 1 })
  })

  it("--ae: the token row is read; an AliExpress order shared by two Affisell orders is never sent", async () => {
    const { d } = deps()
    const report = await runFeeReconciliation(opts({ execute: true, ae: true }), d)
    expect(d.readFacts).toHaveBeenCalledWith(expect.objectContaining({ readAeToken: true }))
    expect(d.aeOrderAmounts).toHaveBeenCalledWith([{ supplierOrderId: SECRETS[5], estimateCents: 1500 }], expect.anything())
    expect(report.aliexpress.byPath.api.byStatus.incertain).toEqual({ commande_aliexpress_partagee: 2 })
  })
})

describe("keys", () => {
  it("a full live key is refused; the reconciliation key wins over the app's key", () => {
    expect(() => pickReconciliationKey({ STRIPE_SECRET_KEY: "sk_live_x" })).toThrow(/cle_complete_refusee/)
    expect(pickReconciliationKey({ STRIPE_RECONCILIATION_KEY: "rk_live_r", STRIPE_SECRET_KEY: "sk_live_x" })).toBe("rk_live_r")
    expect(pickReconciliationKey({ STRIPE_SECRET_KEY: "sk_test_t" })).toBe("sk_test_t")
    expect(() => pickReconciliationKey({})).toThrow(/cle_stripe_absente/)
  })
})

describe("first layer: the client refuses every non-read operation before the database", () => {
  type Hook = (a: { operation: string; args: unknown; query: (args: unknown) => Promise<unknown> }) => Promise<unknown>
  const captured: { hook?: Hook } = {}
  const fake = { $extends: (ext: { query: { $allOperations: Hook } }) => ((captured.hook = ext.query.$allOperations), "extended") }
  readOnlyPrismaClient(fake as never)
  const hook = captured.hook!
  it.each(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany", "$executeRaw", "$executeRawUnsafe", "$queryRawUnsafe", "$runCommandRaw"])("%s is refused", async (op) => {
    const query = vi.fn()
    await expect(hook({ operation: op, args: {}, query })).rejects.toThrow(`reconciliation_write_refused:${op}`)
    expect(query).not.toHaveBeenCalled()
  })
  it("reads pass", async () => {
    for (const op of READ_OPERATIONS) await expect(hook({ operation: op, args: 1, query: async (a) => a })).resolves.toBe(1)
  })
})
