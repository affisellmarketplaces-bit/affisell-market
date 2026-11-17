import { describe, expect, it } from "vitest"

import {
  aeOrderAmount,
  allocateChargeFee,
  buildReport,
  chargeFeeFromBalanceTxs,
  formatReport,
  issuingNetDebit,
  paymentReadPlan,
  reconcilePayment,
  sharedAeOrderIds,
  summarizeGaps,
  type PaymentGroup,
} from "@/lib/strategic-intelligence/fee-reconciliation"

const bt = (over: Record<string, unknown> = {}) => ({ type: "charge", amount: 6000, fee: 199, currency: "eur", fee_details: [{ type: "stripe_fee", amount: 199, currency: "eur" }], ...over })

describe("Stripe fee read from the balance transaction", () => {
  it("processing fee and other fee lines are kept apart", () => {
    expect(chargeFeeFromBalanceTxs([bt({ fee: 240, fee_details: [{ type: "stripe_fee", amount: 199, currency: "eur" }, { type: "tax", amount: 41, currency: "eur" }] })])).toEqual({
      ok: true,
      fee: { amountCents: 6000, stripeFeeCents: 199, otherFeeCents: 41 },
    })
  })
  it("refund and dispute lines of the same source are ignored; anything doubtful is refused", () => {
    expect(chargeFeeFromBalanceTxs([bt(), { type: "refund", amount: -6000, fee: 0, currency: "eur" }]).ok).toBe(true)
    expect(chargeFeeFromBalanceTxs([bt({ currency: "usd" })])).toEqual({ ok: false, reason: "devise_hors_eur" })
    expect(chargeFeeFromBalanceTxs([bt(), bt()])).toEqual({ ok: false, reason: "plusieurs_transactions_de_paiement" })
    expect(chargeFeeFromBalanceTxs([bt({ fee: 300 })])).toEqual({ ok: false, reason: "detail_des_frais_incoherent" })
    expect(chargeFeeFromBalanceTxs([])).toEqual({ ok: false, reason: "aucune_transaction_de_paiement" })
  })
})

describe("a cart's fee is reconciled ONCE per payment, then split without double count", () => {
  it("parts + unattributed = the fee, against the charge amount", () => {
    const a = allocateChargeFee(199, 6000, [{ id: "o1", chargedCents: 3600 }, { id: "o2", chargedCents: 1200 }])!
    expect(a.parts.get("o1")! + a.parts.get("o2")! + a.unattributedCents).toBe(199)
    expect([a.parts.get("o1"), a.parts.get("o2"), a.unattributedCents]).toEqual([119, 40, 40])
    const exact = allocateChargeFee(100, 3000, [{ id: "a", chargedCents: 1000 }, { id: "b", chargedCents: 1000 }, { id: "c", chargedCents: 1000 }])!
    expect([exact.parts.get("a"), exact.parts.get("b"), exact.parts.get("c"), exact.unattributedCents]).toEqual([34, 33, 33, 0])
  })
  it("orders claiming more than the charge are refused, never forced", () => {
    expect(allocateChargeFee(199, 6000, [{ id: "o1", chargedCents: 6000 }, { id: "o2", chargedCents: 1000 }])).toBeNull()
    expect(allocateChargeFee(199, 6000, [{ id: "o1", chargedCents: 6001 }])).not.toBeNull()
  })
  it("the read plan needs the least access: charge id (balance only), then payment intent, else not reconciled", () => {
    const g = (c: string[], p: string[]): PaymentGroup => ({ key: "cs", orders: [], chargeIds: c, paymentIntentIds: p })
    expect(paymentReadPlan(g(["ch_1"], ["pi_1"]))).toEqual({ by: "charge", id: "ch_1" })
    expect(paymentReadPlan(g([], ["pi_1"]))).toEqual({ by: "payment_intent", id: "pi_1" })
    expect(paymentReadPlan(g([], []))).toEqual({ by: "none", reason: "aucun_identifiant_de_paiement_en_base" })
    expect(paymentReadPlan(g(["ch_1", "ch_2"], []))).toEqual({ by: "none", reason: "plusieurs_identifiants_de_paiement" })
  })
  it("statuses: constaté / estimé / non rapproché / incertain", () => {
    const g: PaymentGroup = { key: "cs", orders: [{ id: "o1", chargedCents: 3600 }, { id: "o2", chargedCents: 2400 }], chargeIds: ["ch_1"], paymentIntentIds: [] }
    const ok = reconcilePayment(g, { kind: "read", txs: [bt()] })
    expect(ok).toMatchObject({ status: "constate", estimatePerOrderCents: 129 + 95, estimatePerPaymentCents: 199, unattributedFeeCents: 0 })
    expect(reconcilePayment(g, { kind: "skipped" }).status).toBe("estime")
    expect(reconcilePayment(g, { kind: "no_access" })).toMatchObject({ status: "non_rapproche", reason: "permission_manquante" })
    expect(reconcilePayment(g, { kind: "read", txs: [bt({ currency: "usd" })] }).status).toBe("incertain")
    expect(reconcilePayment({ ...g, chargeIds: [] }, { kind: "skipped" })).toMatchObject({ status: "non_rapproche" })
  })
})

describe("AliExpress debit", () => {
  it("Issuing: captures minus refunds, EUR only", () => {
    expect(issuingNetDebit([{ amount: -2450, currency: "eur", type: "capture" }, { amount: 300, currency: "eur", type: "refund" }])).toEqual({ status: "constate", reason: "ok", cents: 2150 })
    expect(issuingNetDebit([]).status).toBe("non_rapproche")
    expect(issuingNetDebit([{ amount: -2450, currency: "usd", type: "capture" }]).status).toBe("incertain")
  })
  it("API order read: EUR order_amount only, an unknown shape is uncertain", () => {
    expect(aeOrderAmount({ aliexpress_trade_ds_order_get_response: { result: { order_amount: { amount: "24.50", currency_code: "EUR" } } } }).cents).toBe(2450)
    expect(aeOrderAmount({ result: { order_amount: { amount: "24.50", currency_code: "USD" } } }).status).toBe("incertain")
    expect(aeOrderAmount({ result: {} })).toMatchObject({ status: "incertain", reason: "montant_absent_de_la_reponse" })
  })
  it("an AliExpress order id shared by two Affisell orders is not attributable", () => {
    expect([...sharedAeOrderIds([{ supplierOrderId: "1" }, { supplierOrderId: "1" }, { supplierOrderId: "2" }])]).toEqual(["1"])
  })
})

describe("the printed report can not carry sensitive data", () => {
  it("only aggregates reach the text, whatever the inputs contained", () => {
    const secrets = ["cs_live_SECRETSESSION", "ch_SECRETCHARGE", "pi_SECRETINTENT", "ic_SECRETCARD", "buyer@example.com", "8123456789012345", "order_SECRET"]
    const g: PaymentGroup = { key: secrets[0]!, orders: [{ id: secrets[6]!, chargedCents: 6000 }], chargeIds: [secrets[1]!], paymentIntentIds: [secrets[2]!] }
    const report = buildReport({
      days: 30,
      since: new Date("2026-10-18T00:00:00Z"),
      mode: "execute",
      payments: [reconcilePayment(g, { kind: "read", txs: [bt({ description: secrets[4], source: secrets[1] })] })],
      ae: [{ path: "issuing", status: "constate", reason: "ok", estimateCents: 2000, actualCents: 2150 }],
      readScope: ["Stripe : GET /v1/balance_transactions?source=… (balance_read)"],
    })
    const text = formatReport(report) + JSON.stringify(report)
    for (const s of secrets) expect(text).not.toContain(s)
    expect(text).toContain("constaté")
  })
  it("gap summary", () => {
    expect(summarizeGaps([{ estimateCents: 100, actualCents: 110 }, { estimateCents: 100, actualCents: 90 }, { estimateCents: 200, actualCents: 250 }])).toMatchObject({ n: 3, p90AbsGapCents: 50, withinTenCents: 2, relativeGap: 50 / 400 })
    expect(summarizeGaps([])).toBeNull()
  })
})
