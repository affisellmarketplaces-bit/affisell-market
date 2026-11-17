/**
 * Reconciling the two ESTIMATED costs of Affisell's margin with what was really taken — pure, no I/O.
 *
 * Four statuses, never mixed:
 * - `constate`      the real amount was read at its source of truth (Stripe balance transaction, Issuing captures,
 *                   AliExpress's own order record) and can be compared;
 * - `estime`        only Affisell's estimate exists here (nothing was read: plan mode, or out of scope);
 * - `non_rapproche` a real amount should exist but could not be read or linked (no id stored, not found, no access);
 * - `incertain`     something was read but can not be trusted for a comparison (another currency, amounts that do not
 *                   add up, several charges for one payment, an AliExpress order shared by several Affisell orders).
 *
 * 1. Stripe's fee is reconciled PER PAYMENT. A cart's orders are siblings of ONE Checkout Session (`<session>:line:<i>`)
 *    paid by ONE charge; `Order.stripeChargeId` / `stripePaymentIntentId` are UNIQUE, so at most one sibling carries
 *    them. The payment is therefore the base session, the fee is read once, then split over the orders pro rata of
 *    their charged totals AGAINST THE CHARGE AMOUNT — the share of lines that produced no order stays « non attribué »,
 *    and the parts plus that remainder add up to the fee exactly (no double count).
 * 2. What an AliExpress purchase really cost:
 *    - browser/auto-buy path: single-use Stripe Issuing card per order (`FulfillmentLog.virtualCardId`) → its captures;
 *    - AliExpress-API paths (paid by the dropshipping account): `aliexpress.trade.ds.order.get` → `order_amount`
 *      (AliExpress's own record of the order, not a bank statement).
 *
 * Nothing here records anything. Recording real amounts on the order is a money-path change (owner decision).
 */

import { estimateStripeFeeCents } from "@/lib/marketplace-split-amounts"

export type ReconStatus = "constate" | "estime" | "non_rapproche" | "incertain"
export const STATUS_LABELS: Record<ReconStatus, string> = {
  constate: "constaté",
  estime: "estimé seulement",
  non_rapproche: "non rapproché",
  incertain: "incertain",
}

// ---------------------------------------------------------------------------------------------------------------------
// Stripe

/** A balance transaction as the list endpoint returns it (only the fields read). */
export type BalanceTxFacts = { type?: unknown; amount?: unknown; fee?: unknown; currency?: unknown; fee_details?: unknown }

export type ChargeFee = { amountCents: number; stripeFeeCents: number; otherFeeCents: number }

/**
 * The charge's real fee from its balance transaction(s), EUR only. `stripe_fee` lines are Stripe's processing fee;
 * any other fee line (tax on fees, application fee) is kept apart, never mixed in. Null = not comparable.
 */
export function chargeFeeFromBalanceTxs(txs: BalanceTxFacts[]): { ok: true; fee: ChargeFee } | { ok: false; reason: string } {
  const charges = txs.filter((t) => t.type === "charge" || t.type === "payment")
  if (charges.length === 0) return { ok: false, reason: "aucune_transaction_de_paiement" }
  if (charges.length > 1) return { ok: false, reason: "plusieurs_transactions_de_paiement" }
  const t = charges[0]!
  if (t.currency !== "eur") return { ok: false, reason: "devise_hors_eur" }
  if (!isCents(t.amount) || !isCents(t.fee)) return { ok: false, reason: "montants_illisibles" }
  let stripeFee = 0
  let other = 0
  if (Array.isArray(t.fee_details) && t.fee_details.length > 0) {
    for (const d of t.fee_details as Array<{ type?: unknown; amount?: unknown; currency?: unknown }>) {
      if (!isCents(d.amount) || d.currency !== "eur") return { ok: false, reason: "detail_des_frais_illisible" }
      if (d.type === "stripe_fee") stripeFee += d.amount
      else other += d.amount
    }
    if (stripeFee + other !== t.fee) return { ok: false, reason: "detail_des_frais_incoherent" }
  } else {
    stripeFee = t.fee
  }
  return { ok: true, fee: { amountCents: t.amount, stripeFeeCents: stripeFee, otherFeeCents: other } }
}

function isCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0
}

/**
 * Split a charge's fee over its orders pro rata of their charged totals, AGAINST THE CHARGE AMOUNT: Σ parts +
 * `unattributedCents` = fee exactly. Refuses (null) when the orders claim more than the charge (± 1 cent per order).
 */
export function allocateChargeFee(
  feeCents: number,
  chargeAmountCents: number,
  orders: Array<{ id: string; chargedCents: number }>
): { parts: Map<string, number>; unattributedCents: number } | null {
  const claimed = orders.reduce((a, o) => a + Math.max(0, o.chargedCents), 0)
  if (chargeAmountCents <= 0 || claimed > chargeAmountCents + orders.length) return null
  const denominator = Math.max(claimed, chargeAmountCents)
  const target = Math.round((feeCents * claimed) / denominator)
  const exact = orders.map((o) => (feeCents * Math.max(0, o.chargedCents)) / denominator)
  const parts = exact.map(Math.floor)
  let rest = target - parts.reduce((a, b) => a + b, 0)
  const byFraction = exact.map((x, i) => ({ i, f: x - parts[i]! })).sort((a, b) => b.f - a.f || a.i - b.i)
  for (const { i } of byFraction) {
    if (rest <= 0) break
    parts[i]! += 1
    rest -= 1
  }
  const map = new Map<string, number>()
  orders.forEach((o, i) => map.set(o.id, parts[i]!))
  return { parts: map, unattributedCents: feeCents - parts.reduce((a, b) => a + b, 0) }
}

export type PaymentOrder = { id: string; chargedCents: number }
export type PaymentGroup = {
  /** Base Checkout Session id — used as a key only, never printed. */
  key: string
  orders: PaymentOrder[]
  chargeIds: string[]
  paymentIntentIds: string[]
}

export type StripeLookup =
  | { kind: "read"; txs: BalanceTxFacts[] }
  | { kind: "not_found" }
  | { kind: "no_access" }
  | { kind: "error" }
  | { kind: "skipped" }

export type PaymentRecon = {
  status: ReconStatus
  reason: string
  orderCount: number
  /** Σ of the cockpit's per-order estimates (2.9 % + 25 c of each order's TTC). */
  estimatePerOrderCents: number
  /** The same formula applied ONCE to the whole charge (what Stripe's standard pricing would take). */
  estimatePerPaymentCents: number | null
  actual: ChargeFee | null
  unattributedFeeCents: number | null
  parts: Map<string, number> | null
}

/** Which Stripe id the payment can be read by, in order of least access needed. */
export function paymentReadPlan(g: PaymentGroup): { by: "charge"; id: string } | { by: "payment_intent"; id: string } | { by: "none"; reason: string } {
  const charges = [...new Set(g.chargeIds)]
  const intents = [...new Set(g.paymentIntentIds)]
  if (charges.length > 1 || intents.length > 1) return { by: "none", reason: "plusieurs_identifiants_de_paiement" }
  if (charges[0]) return { by: "charge", id: charges[0] }
  if (intents[0]) return { by: "payment_intent", id: intents[0] }
  return { by: "none", reason: "aucun_identifiant_de_paiement_en_base" }
}

export function reconcilePayment(g: PaymentGroup, lookup: StripeLookup): PaymentRecon {
  const estimatePerOrderCents = g.orders.reduce((a, o) => a + estimateStripeFeeCents(o.chargedCents), 0)
  const base = { orderCount: g.orders.length, estimatePerOrderCents, estimatePerPaymentCents: null, actual: null, unattributedFeeCents: null, parts: null }
  const plan = paymentReadPlan(g)
  if (plan.by === "none") {
    return { ...base, status: plan.reason === "plusieurs_identifiants_de_paiement" ? "incertain" : "non_rapproche", reason: plan.reason }
  }
  if (lookup.kind === "skipped") return { ...base, status: "estime", reason: "lecture_non_lancee" }
  if (lookup.kind !== "read") return { ...base, status: "non_rapproche", reason: lookup.kind === "no_access" ? "permission_manquante" : lookup.kind === "not_found" ? "introuvable_chez_stripe" : "erreur_de_lecture" }
  const fee = chargeFeeFromBalanceTxs(lookup.txs)
  if (!fee.ok) return { ...base, status: fee.reason === "aucune_transaction_de_paiement" ? "non_rapproche" : "incertain", reason: fee.reason }
  const total = fee.fee.stripeFeeCents + fee.fee.otherFeeCents
  const alloc = allocateChargeFee(total, fee.fee.amountCents, g.orders)
  const estimatePerPaymentCents = estimateStripeFeeCents(fee.fee.amountCents)
  if (!alloc) return { ...base, estimatePerPaymentCents, actual: fee.fee, status: "incertain", reason: "commandes_superieures_au_paiement" }
  return { ...base, estimatePerPaymentCents, actual: fee.fee, unattributedFeeCents: alloc.unattributedCents, parts: alloc.parts, status: "constate", reason: "ok" }
}

// ---------------------------------------------------------------------------------------------------------------------
// AliExpress

/** What an Issuing card really paid: captures (negative amounts) minus refunds; EUR only. */
export function issuingNetDebit(
  transactions: Array<{ amount?: unknown; currency?: unknown; type?: unknown }>
): { status: ReconStatus; reason: string; cents: number | null } {
  if (transactions.length === 0) return { status: "non_rapproche", reason: "aucune_capture", cents: null }
  let net = 0
  for (const t of transactions) {
    if (t.currency !== "eur") return { status: "incertain", reason: "devise_hors_eur", cents: null }
    if (typeof t.amount !== "number" || !Number.isInteger(t.amount)) return { status: "incertain", reason: "montant_illisible", cents: null }
    if (t.type === "capture" || t.type === "refund") net += -t.amount
  }
  return { status: "constate", reason: "ok", cents: net }
}

/**
 * The amount of an AliExpress order from `aliexpress.trade.ds.order.get`, EUR only (same rule as
 * `aliexpress-price-eur.ts`: a foreign amount is never read as euros). Parser written from AliExpress's public
 * documentation (`result.order_amount { amount, currency_code }`), not yet from a live answer: an unreadable shape is
 * `incertain`, never a guess.
 */
export function aeOrderAmount(payload: unknown): { status: ReconStatus; reason: string; cents: number | null } {
  const root = payload as Record<string, unknown> | null
  const resp = (root?.["aliexpress_trade_ds_order_get_response"] ?? root) as Record<string, unknown> | undefined
  const result = (resp?.["result"] ?? resp) as Record<string, unknown> | undefined
  const amt = result?.["order_amount"] as { amount?: unknown; currency_code?: unknown } | undefined
  if (!amt) return { status: "incertain", reason: "montant_absent_de_la_reponse", cents: null }
  if (String(amt.currency_code ?? "").toUpperCase() !== "EUR") return { status: "incertain", reason: "devise_hors_eur", cents: null }
  const n = typeof amt.amount === "number" ? amt.amount : typeof amt.amount === "string" && /^\d+(\.\d{1,2})?$/.test(amt.amount.trim()) ? Number(amt.amount) : NaN
  if (!Number.isFinite(n) || n < 0) return { status: "incertain", reason: "montant_illisible", cents: null }
  return { status: "constate", reason: "ok", cents: Math.round(n * 100) }
}

export type AeRecon = { path: "issuing" | "api"; status: ReconStatus; reason: string; estimateCents: number | null; actualCents: number | null }

/** AliExpress order ids shared by several Affisell orders can not be attributed to one of them: `incertain`. */
export function sharedAeOrderIds(rows: Array<{ supplierOrderId: string }>): Set<string> {
  const seen = new Map<string, number>()
  for (const r of rows) seen.set(r.supplierOrderId, (seen.get(r.supplierOrderId) ?? 0) + 1)
  return new Set([...seen].filter(([, n]) => n > 1).map(([id]) => id))
}

// ---------------------------------------------------------------------------------------------------------------------
// Summaries and output

export type GapSummary = {
  n: number
  estimateCents: number
  actualCents: number
  meanGapCents: number
  meanAbsGapCents: number
  p90AbsGapCents: number
  withinTenCents: number
  relativeGap: number | null
}

/** real − estimate over comparable rows. */
export function summarizeGaps(rows: Array<{ estimateCents: number; actualCents: number }>): GapSummary | null {
  if (rows.length === 0) return null
  const gaps = rows.map((r) => r.actualCents - r.estimateCents)
  const abs = gaps.map(Math.abs).sort((a, b) => a - b)
  const est = rows.reduce((a, r) => a + r.estimateCents, 0)
  const act = rows.reduce((a, r) => a + r.actualCents, 0)
  return {
    n: rows.length,
    estimateCents: est,
    actualCents: act,
    meanGapCents: gaps.reduce((a, b) => a + b, 0) / rows.length,
    meanAbsGapCents: abs.reduce((a, b) => a + b, 0) / rows.length,
    p90AbsGapCents: abs[Math.min(abs.length - 1, Math.ceil(0.9 * abs.length) - 1)]!,
    withinTenCents: abs.filter((g) => g <= 10).length,
    relativeGap: est > 0 ? (act - est) / est : null,
  }
}

export function countByStatus<T extends { status: ReconStatus; reason: string }>(rows: T[]): Record<ReconStatus, Record<string, number>> {
  const out: Record<ReconStatus, Record<string, number>> = { constate: {}, estime: {}, non_rapproche: {}, incertain: {} }
  for (const r of rows) out[r.status][r.reason] = (out[r.status][r.reason] ?? 0) + 1
  return out
}

export type ReconReport = {
  window: { days: number; since: string }
  mode: "plan" | "execute"
  stripe: {
    payments: number
    carts: number
    byStatus: Record<ReconStatus, Record<string, number>>
    /** On `constate` payments: real fee vs the cockpit's per-order estimate, and vs the formula applied once per payment. */
    vsPerOrderEstimate: GapSummary | null
    vsPerPaymentEstimate: GapSummary | null
    cartsVsPerOrderEstimate: GapSummary | null
    otherFeeCents: number
    unattributedFeeCents: number
  }
  aliexpress: {
    byPath: Record<"issuing" | "api", { orders: number; byStatus: Record<ReconStatus, Record<string, number>>; gaps: GapSummary | null; withoutEstimate: number }>
  }
  readScope: string[]
  notes: string[]
}

export function buildReport(args: {
  days: number
  since: Date
  mode: "plan" | "execute"
  payments: PaymentRecon[]
  ae: AeRecon[]
  readScope: string[]
}): ReconReport {
  const done = args.payments.filter((p) => p.status === "constate" && p.actual)
  const real = (p: PaymentRecon) => p.actual!.stripeFeeCents + p.actual!.otherFeeCents
  const byPath = (path: "issuing" | "api") => {
    const rows = args.ae.filter((r) => r.path === path)
    const comparable = rows.filter((r) => r.status === "constate" && r.actualCents !== null && r.estimateCents !== null)
    return {
      orders: rows.length,
      byStatus: countByStatus(rows),
      gaps: summarizeGaps(comparable.map((r) => ({ estimateCents: r.estimateCents!, actualCents: r.actualCents! }))),
      withoutEstimate: rows.filter((r) => r.status === "constate" && r.estimateCents === null).length,
    }
  }
  return {
    window: { days: args.days, since: args.since.toISOString() },
    mode: args.mode,
    stripe: {
      payments: args.payments.length,
      carts: args.payments.filter((p) => p.orderCount > 1).length,
      byStatus: countByStatus(args.payments),
      vsPerOrderEstimate: summarizeGaps(done.map((p) => ({ estimateCents: p.estimatePerOrderCents, actualCents: real(p) }))),
      vsPerPaymentEstimate: summarizeGaps(done.map((p) => ({ estimateCents: p.estimatePerPaymentCents!, actualCents: real(p) }))),
      cartsVsPerOrderEstimate: summarizeGaps(done.filter((p) => p.orderCount > 1).map((p) => ({ estimateCents: p.estimatePerOrderCents, actualCents: real(p) }))),
      otherFeeCents: done.reduce((a, p) => a + p.actual!.otherFeeCents, 0),
      unattributedFeeCents: done.reduce((a, p) => a + (p.unattributedFeeCents ?? 0), 0),
    },
    aliexpress: { byPath: { issuing: byPath("issuing"), api: byPath("api") } },
    readScope: args.readScope,
    notes: [
      "Écarts = réel − estimation, en centimes, sur les seuls montants constatés.",
      "Frais Stripe rapprochés au niveau du paiement puis répartis : la part des lignes sans commande reste « non attribuée ».",
      "Stripe ne rend pas ses frais lors d'un remboursement : les frais d'un paiement remboursé restent dus.",
      "Débit AliExpress API = relevé de commande AliExpress, pas un relevé bancaire.",
      "Lecture seule : rien n'a été écrit ni enregistré.",
    ],
  }
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`
function fmtGap(s: GapSummary | null): string {
  if (!s) return "aucune donnée comparable"
  const rel = s.relativeGap === null ? "n/a" : `${(s.relativeGap * 100).toFixed(1).replace(".", ",")} %`
  return `${s.n} · réel ${eur(s.actualCents)} vs estimé ${eur(s.estimateCents)} (${rel}) · écart moyen ${s.meanGapCents.toFixed(1)} c · |écart| p90 ${s.p90AbsGapCents} c · ≤ 10 c : ${s.withinTenCents}/${s.n}`
}
function fmtStatus(by: Record<ReconStatus, Record<string, number>>): string[] {
  return (Object.keys(by) as ReconStatus[])
    .filter((k) => Object.keys(by[k]).length > 0)
    .map((k) => `    ${STATUS_LABELS[k]} : ${Object.entries(by[k]).map(([r, n]) => `${r} ${n}`).join(", ")}`)
}

/** Human-readable text built ONLY from the report's aggregates: no id, no e-mail, no card, no token can reach it. */
export function formatReport(r: ReconReport): string {
  const lines = [
    `Rapprochement des frais — ${r.mode === "plan" ? "PLAN (aucune lecture externe)" : "lecture"} — ${r.window.days} jours depuis ${r.window.since.slice(0, 10)}`,
    "",
    `Frais Stripe — ${r.stripe.payments} paiements (dont ${r.stripe.carts} paniers)`,
    ...fmtStatus(r.stripe.byStatus),
    `  vs estimation par commande (cockpit) : ${fmtGap(r.stripe.vsPerOrderEstimate)}`,
    `  vs même formule appliquée une fois par paiement : ${fmtGap(r.stripe.vsPerPaymentEstimate)}`,
    `  paniers seulement, vs estimation par commande : ${fmtGap(r.stripe.cartsVsPerOrderEstimate)}`,
    `  autres frais (hors frais de traitement) : ${eur(r.stripe.otherFeeCents)} · non attribués (lignes sans commande) : ${eur(r.stripe.unattributedFeeCents)}`,
  ]
  for (const path of ["issuing", "api"] as const) {
    const p = r.aliexpress.byPath[path]
    lines.push("", `Débit AliExpress — ${path === "issuing" ? "cartes Issuing (achat automatique)" : "API AliExpress (compte dropshipping)"} — ${p.orders} commandes`)
    lines.push(...fmtStatus(p.byStatus), `  vs estimation (aeWholesaleCents) : ${fmtGap(p.gaps)}`)
    if (p.withoutEstimate > 0) lines.push(`  constatés sans estimation à comparer : ${p.withoutEstimate}`)
  }
  lines.push("", "Périmètre de lecture :", ...r.readScope.map((s) => `  - ${s}`), "", ...r.notes)
  return lines.join("\n")
}
