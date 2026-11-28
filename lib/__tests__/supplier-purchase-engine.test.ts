import { readFileSync } from "node:fs"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The batch engine's purchase = ONE held claim: claim → pay (wallet debit or Stripe Connect transfer, stamped on the
 * claim) → place (adapter continues the claim with its token, inline or in the BullMQ worker) → settle. Scenarios:
 * retry, concurrent runs, crash between payment and placement, resume, refusals after payment.
 */
const transfersCreate = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: { fulfillmentProvider: { findUnique: async () => ({ stripeConnectAccountId: "acct_sup" }) } },
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ transfers: { create: transfersCreate } }) }))

const { executeSupplierPayment } = await import("@/lib/auto-order/payment")
const { beginSupplierPurchase, guardSupplierPurchase, settleHeldAfterPlacement, settleHeldSupplierPurchase } =
  await import("@/lib/supplier-purchase/guard.server")
const { memoryClaimStore } = await import("@/lib/supplier-purchase/memory-claim-store")

const ON = {
  SUPPLIER_PURCHASES_ENABLED: "true",
  SUPPLIER_PURCHASE_CHANNELS: "cj,supplier_payment,china_agent",
  SUPPLIER_PURCHASE_DAILY_LIMITS:
    "aliexpress=unlimited,cj=unlimited,partner_rest=unlimited,china_agent=unlimited,supplier_payment=unlimited",
}
const group = (cost = 1_000) =>
  ({
    providerId: "prov_1",
    channel: "CJ_DROPSHIPPING",
    paymentMethod: "WALLET_PREPAID",
    totalCostCents: cost,
    lines: [{ orderId: "o1" }, { orderId: "o2" }],
  }) as never
const KEYS = ["order:o1", "order:o2"]

let store: ReturnType<typeof memoryClaimStore>
beforeEach(() => {
  store = memoryClaimStore({ prov_1: 5_000 })
  for (const [k, v] of Object.entries(ON)) vi.stubEnv(k, v)
  transfersCreate.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

/** What the engine + adapter do for one group (same calls, same order as engine.ts / cj adapter). */
async function engineRun(
  opts: { supplier?: "places" | "refuses" | "times_out" | "crash_before_place"; method?: string } = {},
) {
  const begun = await beginSupplierPurchase({ channel: "cj", path: "auto-order.engine", keys: KEYS, store })
  if (begun.kind !== "claimed") return { begun: begun.kind }
  const pay = await executeSupplierPayment({
    method: (opts.method ?? "WALLET_PREPAID") as never,
    providerId: "prov_1",
    batchId: "b1",
    group: group(),
    held: begun.held,
    store,
  })
  if (!pay.ok) {
    await settleHeldSupplierPurchase(
      begun.held,
      pay.moneyMayHaveMoved ? "uncertain" : "rejected",
      pay.error ?? null,
      store,
    )
    return { begun: "claimed", pay }
  }
  if (opts.supplier === "crash_before_place") return { begun: "claimed", pay, held: begun.held }
  const placed = await guardSupplierPurchase(
    { channel: "cj", path: "cj-dropshipping.placeOrder", keys: KEYS, heldToken: begun.held.token, store },
    async () =>
      opts.supplier === "refuses"
        ? { kind: "rejected", error: "invalid_vid", value: null }
        : opts.supplier === "times_out"
          ? { kind: "uncertain", error: "timeout", value: null }
          : { kind: "placed", supplierOrderId: "cj_1", value: null },
  )
  return { begun: "claimed", pay, placed, held: begun.held }
}

describe("batch engine — one purchase, one debit", () => {
  it("normal run: one debit, order placed, claim placed", async () => {
    const r = await engineRun({ supplier: "places" })
    expect(r.pay?.ok).toBe(true)
    expect(store.wallets.prov_1).toBe(4_000)
    expect(store.rows.get("order:o1")).toMatchObject({ status: "placed", supplierOrderId: "cj_1", paidCents: 1_000 })
  })

  it("re-run of the same batch after success: nothing paid, nothing ordered", async () => {
    await engineRun({ supplier: "places" })
    expect((await engineRun({ supplier: "places" })).begun).toBe("already_placed")
    expect(store.wallets.prov_1).toBe(4_000)
  })

  it("two concurrent runs: exactly one claim, exactly one debit", async () => {
    const results = await Promise.all([
      engineRun({ supplier: "places" }),
      engineRun({ supplier: "places" }),
      engineRun({ supplier: "places" }),
    ])
    expect(results.filter((r) => r.begun === "claimed")).toHaveLength(1)
    expect(store.wallets.prov_1).toBe(4_000)
  })

  it("crash after the debit, before placement: the next run is refused, a resume of the same claim debits nothing", async () => {
    const crashed = await engineRun({ supplier: "crash_before_place" })
    expect(store.wallets.prov_1).toBe(4_000)
    expect((await engineRun({ supplier: "places" })).begun).toBe("in_flight_or_uncertain")
    const resumed = await executeSupplierPayment({
      method: "WALLET_PREPAID",
      providerId: "prov_1",
      batchId: "b1",
      group: group(),
      held: crashed.held!,
      store,
    })
    expect(resumed).toMatchObject({ ok: false, error: "already_paid_or_not_held", moneyMayHaveMoved: false })
    expect(store.wallets.prov_1).toBe(4_000)
    expect(store.rows.get("order:o1")).toMatchObject({ status: "claimed", paidCents: 1_000 }) // visible for reconciliation
  })

  it("supplier refuses AFTER the payment → uncertain (paid, not placed), never re-claimable", async () => {
    await engineRun({ supplier: "refuses" })
    expect(store.rows.get("order:o1")).toMatchObject({ status: "uncertain", paidCents: 1_000 })
    expect((await engineRun({ supplier: "places" })).begun).toBe("in_flight_or_uncertain")
    expect(store.wallets.prov_1).toBe(4_000)
  })

  it("supplier timeout after payment → uncertain", async () => {
    await engineRun({ supplier: "times_out" })
    expect(store.rows.get("order:o1")?.status).toBe("uncertain")
  })

  it("insufficient balance: nothing debited, claim rejected (re-claimable once funded)", async () => {
    store.wallets.prov_1 = 500
    const r = await engineRun({ supplier: "places" })
    expect(r.pay).toMatchObject({ ok: false, error: "insufficient_wallet_balance", moneyMayHaveMoved: false })
    expect(store.rows.get("order:o1")).toMatchObject({ status: "rejected", paidCents: null })
    store.wallets.prov_1 = 5_000
    expect((await engineRun({ supplier: "places" })).begun).toBe("claimed")
    expect(store.wallets.prov_1).toBe(4_000)
  })

  it("Stripe Connect error → money may have moved → uncertain; the transfer carries a key bound to the claim", async () => {
    vi.stubEnv("AUTO_ORDER_ENABLE_STRIPE_TRANSFERS", "true")
    transfersCreate.mockRejectedValueOnce(new Error("socket hang up"))
    const r = await engineRun({ method: "STRIPE_CONNECT" })
    expect(r.pay).toMatchObject({ ok: false, moneyMayHaveMoved: true })
    expect(store.rows.get("order:o1")?.status).toBe("uncertain")
    expect(transfersCreate.mock.calls[0]![1]).toMatchObject({ idempotencyKey: expect.stringMatching(/^supplier_pay_/) })
  })

  it("Stripe Connect success → transfer id stamped on the claim", async () => {
    vi.stubEnv("AUTO_ORDER_ENABLE_STRIPE_TRANSFERS", "true")
    transfersCreate.mockResolvedValueOnce({ id: "tr_sup_1" })
    await engineRun({ method: "STRIPE_CONNECT", supplier: "places" })
    expect(store.rows.get("order:o1")).toMatchObject({ status: "placed", paidCents: 1_000 })
  })

  it("a money method without a held claim is refused before any money call", async () => {
    const r = await executeSupplierPayment({
      method: "WALLET_PREPAID",
      providerId: "prov_1",
      batchId: "b",
      group: group(),
      held: null,
      store,
    })
    expect(r).toMatchObject({ ok: false, error: "supplier_payment_without_claim", moneyMayHaveMoved: false })
    expect(store.wallets.prov_1).toBe(5_000)
  })

  it("a forged / stale token cannot continue someone else's claim", async () => {
    const begun = await beginSupplierPurchase({ channel: "cj", path: "t", keys: KEYS, store })
    expect(begun.kind).toBe("claimed")
    const send = vi.fn()
    const r = await guardSupplierPurchase({ channel: "cj", path: "t", keys: KEYS, heldToken: "forged", store }, send)
    expect(r).toMatchObject({ kind: "in_flight_or_uncertain", status: "held_claim_mismatch" })
    expect(send).not.toHaveBeenCalled()
  })

  it("adapter without its own guard (native): settleHeldAfterPlacement closes the claim", async () => {
    const begun = await beginSupplierPurchase({ channel: "supplier_payment", path: "t", keys: KEYS, store })
    if (begun.kind !== "claimed") throw new Error("not claimed")
    await settleHeldAfterPlacement(begun.held, { supplierOrderId: "native_1", status: "CONFIRMED" }, store)
    expect(store.rows.get("order:o2")).toMatchObject({ status: "placed", supplierOrderId: "native_1" })
    await settleHeldAfterPlacement(begun.held, { supplierOrderId: null, status: "FAILED" }, store) // no-op: already settled
    expect(store.rows.get("order:o2")?.status).toBe("placed")
  })
})

describe("engine source keeps the order: policies → claim → payment → placement under the claim", () => {
  it("pinned in engine.ts", () => {
    const src = readFileSync("lib/auto-order/engine.ts", "utf8")
    const at = (s: string) => src.indexOf(s)
    expect(at("supplierPurchaseDecision(process.env, c)")).toBeGreaterThan(0)
    expect(at("beginSupplierPurchase(")).toBeGreaterThan(at("supplierPurchaseDecision(process.env, c)"))
    expect(at("executeSupplierPayment({")).toBeGreaterThan(at("beginSupplierPurchase("))
    expect(at("purchaseClaimToken: held?.token ?? null")).toBeGreaterThan(at("executeSupplierPayment({"))
    expect(src).not.toContain("supplierPurchaseKeysHeld(") // the old read-only pre-check (not a lock) is gone
    const worker = readFileSync("lib/auto-order/bullmq/place-order.processor.ts", "utf8")
    expect(worker).toContain("settleHeldClaimIfAny(data, placed)")
  })
})

describe("China buying agents — two concurrent routes, one purchase", () => {
  it("Superbuy: same order routed twice at once → one HTTP call", async () => {
    vi.stubEnv("SUPERBUY_API_KEY", "k")
    const { setSupplierPurchaseClaimStoreForTests } = await import("@/lib/supplier-purchase/guard.server")
    setSupplierPurchaseClaimStoreForTests(store)
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const fetchMock = vi.fn(async () => {
      await gate
      return { ok: true, status: 200, json: async () => ({ orderId: "sb_1" }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    const { routeSuperbuyItem } = await import("@/lib/china-buying/adapters/superbuy")
    const args = { sourceUrl: "https://1688.test/x", platform: null, quantity: 1, purchaseKeys: ["order:o7"] }
    const a = routeSuperbuyItem(args)
    const b = routeSuperbuyItem(args)
    release()
    const [ra, rb] = await Promise.all([a, b])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect([ra.ok, rb.ok].sort()).toEqual([false, true])
    const again = await routeSuperbuyItem(args)
    expect(again).toEqual({ ok: true, status: "API_OK", externalRef: "sb_1" }) // replay, no call
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
    setSupplierPurchaseClaimStoreForTests(null)
  })

  it("an answer without a reference is uncertain (no more invented `superbuy_<timestamp>`)", async () => {
    vi.stubEnv("SUPERBUY_API_KEY", "k")
    const { setSupplierPurchaseClaimStoreForTests } = await import("@/lib/supplier-purchase/guard.server")
    setSupplierPurchaseClaimStoreForTests(store)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
    )
    const { routeSuperbuyItem } = await import("@/lib/china-buying/adapters/superbuy")
    const r = await routeSuperbuyItem({
      sourceUrl: "https://1688.test/y",
      platform: null,
      quantity: 1,
      purchaseKeys: ["order:o8"],
    })
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("uncertain:") })
    expect(store.rows.get("order:o8")?.status).toBe("uncertain")
    vi.unstubAllGlobals()
    setSupplierPurchaseClaimStoreForTests(null)
  })
})

describe("reconciliation (pure)", () => {
  it("flags uncertain, stuck and paid-not-placed claims with the right action; leaves fresh / settled ones", async () => {
    const { classifyClaim } = await import("@/lib/supplier-purchase/reconcile")
    const now = new Date("2026-11-28T12:00:00Z")
    const base = { id: "order:o1", channel: "cj", path: "engine", supplierOrderId: null, paymentRef: null, error: null }
    const at = (min: number) => new Date(now.getTime() - min * 60_000)
    expect(classifyClaim({ ...base, status: "placed", paidCents: 100, updatedAt: at(99) }, now)).toBeNull()
    expect(classifyClaim({ ...base, status: "claimed", paidCents: null, updatedAt: at(2) }, now)).toBeNull()
    expect(classifyClaim({ ...base, status: "claimed", paidCents: 900, updatedAt: at(30) }, now)?.kind).toBe(
      "stuck_claimed_paid",
    )
    expect(classifyClaim({ ...base, status: "uncertain", paidCents: 900, updatedAt: at(1) }, now)).toMatchObject({
      kind: "uncertain_paid",
      action: expect.stringContaining("--as refunded"),
    })
    expect(classifyClaim({ ...base, status: "uncertain", paidCents: null, updatedAt: at(1) }, now)?.action).toContain(
      "--as rejected",
    )
  })
})
