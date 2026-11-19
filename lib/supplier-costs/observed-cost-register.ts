/**
 * Register of costs Affisell has REALLY observed for a source purchase — DESIGN + pure logic, no storage yet.
 *
 * Four kinds of entry, never added together, never substituted for one another:
 *  - `stored_source_price` : the source price Affisell MEMORISED (e.g. `SupplierLink.aePriceCents`, frozen on the order as
 *                            `Order.aeWholesaleCents`). Affisell's own record, not money that moved.
 *  - `charged_amount`      : what was EFFECTIVELY debited for the purchase (Issuing capture − refunds, a supplier
 *                            invoice paid). The only kind that is money that moved.
 *  - `fee`                 : costs attached to the purchase but not the goods (card / FX fees, customs, platform fee).
 *  - `evidence`            : a document that supports an entry (invoice number, order record) — carries no amount.
 *
 * Every amount carries its PERIMETER (what it covers: currency, unit or line total, delivery included or not, VAT
 * included / excluded / unknown, variant) and its RELIABILITY, with the same four statuses as `report:fee-reconciliation`
 * (`constate` read at the source of truth, `estime` Affisell's own estimate, `non_rapproche`, `incertain`).
 *
 * Today only `stored_source_price` entries can be built (from order snapshots); `charged_amount` and `fee` entries will
 * come from the reconciliation report or from an admin, once storage exists (a table = migration = founder decision).
 * Nothing here touches a financial flow. Pure module.
 */
export const OBSERVED_COST_KINDS = ["stored_source_price", "charged_amount", "fee", "evidence"] as const
export type ObservedCostKind = (typeof OBSERVED_COST_KINDS)[number]

export const OBSERVED_COST_SOURCES = [
  "order_snapshot", // Order.aeWholesaleCents, frozen at payment
  "issuing_capture", // Stripe Issuing capture − refunds of the single-use card (reconciliation)
  "source_order_record", // the source's own order record (e.g. AliExpress order_amount) — not a bank statement
  "supplier_invoice", // an invoice, entered and checked by an admin
  "manual_admin", // an amount entered by an admin, with a note
] as const
export type ObservedCostSource = (typeof OBSERVED_COST_SOURCES)[number]

export type Reliability = "constate" | "estime" | "non_rapproche" | "incertain"

/** What an amount covers. Two amounts are comparable only when their perimeters are the same and fully known. */
export type CostPerimeter = {
  currency: string | null
  /** `unit` = one unit; `line` = the whole order line (quantity included). */
  basis: "unit" | "line"
  includesDelivery: boolean | null
  /** VAT treatment: excluded (HT), included (TTC) or not known. */
  vat: "excluded" | "included" | "unknown"
  /** The variant the amount is for (null = the product as a whole / no variants). */
  variantKey: string | null
}

export type ObservedCostEntry = {
  kind: ObservedCostKind
  orderId: string
  productId: string
  quantity: number
  /** Null for `evidence`. Integer minor units of `perimeter.currency`. */
  amountCents: number | null
  perimeter: CostPerimeter
  source: ObservedCostSource
  reliability: Reliability
  observedAt: string
  /** For `evidence`: what the document is (number, date) — never a file or personal data. */
  note: string
}

/**
 * The stored source price frozen on an Affisell auto-buy order. What the code writes (lib/stripe-marketplace-fulfill.ts):
 * `aePriceCents × quantity`, euros, delivery EXCLUDED (shipping is not in it), VAT treatment NOT known (the AliExpress
 * price may or may not carry the EU import VAT). Reliability `estime`: it is Affisell's memorised price, not a debit.
 */
export function entryFromOrderSnapshot(o: {
  orderId: string
  productId: string
  paidAt: Date
  quantity: number
  aeWholesaleCents: number | null
  currency: string | null
  variantLabel: string | null
}): ObservedCostEntry | null {
  if (!o.aeWholesaleCents || o.aeWholesaleCents <= 0) return null
  return {
    kind: "stored_source_price",
    orderId: o.orderId,
    productId: o.productId,
    quantity: Math.max(1, Math.round(o.quantity)),
    amountCents: o.aeWholesaleCents,
    perimeter: {
      currency: (o.currency ?? "EUR").toUpperCase(),
      basis: "line",
      includesDelivery: false,
      vat: "unknown",
      variantKey: o.variantLabel?.trim() ? o.variantLabel.trim() : null,
    },
    source: "order_snapshot",
    reliability: "estime",
    observedAt: o.paidAt.toISOString(),
    note: "",
  }
}

/** Validation of an entry before it would ever be stored: the kind / amount / source combination must make sense. */
export function validateObservedCostEntry(e: ObservedCostEntry): string[] {
  const errors: string[] = []
  if (!(OBSERVED_COST_KINDS as readonly string[]).includes(e.kind)) errors.push("kind_invalid")
  if (!(OBSERVED_COST_SOURCES as readonly string[]).includes(e.source)) errors.push("source_invalid")
  if (e.kind === "evidence") {
    if (e.amountCents !== null) errors.push("evidence_has_no_amount")
    if (e.note.trim().length < 3) errors.push("evidence_needs_description")
  } else if (e.amountCents === null || !Number.isInteger(e.amountCents) || e.amountCents < 0) {
    errors.push("amount_invalid")
  }
  if (e.kind === "charged_amount" && e.source === "order_snapshot") errors.push("snapshot_is_not_a_debit")
  if (e.kind === "stored_source_price" && e.source === "issuing_capture") errors.push("capture_is_not_a_stored_price")
  if (e.kind === "charged_amount" && e.reliability === "estime") errors.push("a_debit_is_read_not_estimated")
  if (!Number.isInteger(e.quantity) || e.quantity < 1) errors.push("quantity_invalid")
  if (e.kind !== "evidence" && !e.perimeter.currency) errors.push("currency_unknown")
  return errors
}

export type OrderCostSummary = {
  orderId: string
  storedSourcePriceCents: number | null
  chargedAmountCents: number | null
  feesCents: number
  /** charged − stored, only when both exist with the SAME perimeter; null otherwise (with the reason). */
  storedVsChargedGapCents: number | null
  gapUnavailableReason: string | null
  evidence: string[]
  /** Amounts that could not be summed because their perimeters differ (kept, never forced). */
  unsummable: number
}

/** Per order: the kinds side by side. Fees are summed only within one currency; nothing is added across kinds. */
export function summarizeOrderCosts(entries: ReadonlyArray<ObservedCostEntry>): OrderCostSummary[] {
  const byOrder = new Map<string, ObservedCostEntry[]>()
  for (const e of entries) byOrder.set(e.orderId, [...(byOrder.get(e.orderId) ?? []), e])
  return [...byOrder.entries()].map(([orderId, list]) => {
    const stored = list.filter((e) => e.kind === "stored_source_price")
    const charged = list.filter((e) => e.kind === "charged_amount")
    const fees = list.filter((e) => e.kind === "fee")
    const currencies = new Set(fees.map((f) => f.perimeter.currency))
    const feesCents = currencies.size <= 1 ? fees.reduce((s, f) => s + (f.amountCents ?? 0), 0) : 0
    let gap: number | null = null
    let reason: string | null = null
    if (stored.length !== 1 || charged.length !== 1) {
      reason = stored.length === 0 ? "prix mémorisé absent" : charged.length === 0 ? "montant débité non constaté" : "plusieurs montants du même type"
    } else {
      const mismatch = perimeterMismatches(stored[0].perimeter, charged[0].perimeter)
      if (mismatch.length > 0) reason = `périmètres différents : ${mismatch.join(", ")}`
      else gap = (charged[0].amountCents ?? 0) - (stored[0].amountCents ?? 0)
    }
    return {
      orderId,
      storedSourcePriceCents: stored.length === 1 ? stored[0].amountCents : null,
      chargedAmountCents: charged.length === 1 ? charged[0].amountCents : null,
      feesCents,
      storedVsChargedGapCents: gap,
      gapUnavailableReason: reason,
      evidence: list.filter((e) => e.kind === "evidence").map((e) => e.note),
      unsummable: currencies.size > 1 ? fees.length : 0,
    }
  })
}

/** Every way two perimeters differ or are not fully known — an empty list is the ONLY "comparable". */
export function perimeterMismatches(a: CostPerimeter, b: CostPerimeter): string[] {
  const out: string[] = []
  if (!a.currency || !b.currency) out.push("devise inconnue")
  else if (a.currency !== b.currency) out.push("devises différentes")
  if (a.basis !== b.basis) out.push("unité / ligne")
  if (a.includesDelivery === null || b.includesDelivery === null) out.push("livraison incluse ou non inconnue")
  else if (a.includesDelivery !== b.includesDelivery) out.push("livraison incluse d'un côté seulement")
  if (a.vat === "unknown" || b.vat === "unknown") out.push("traitement de la TVA inconnu")
  else if (a.vat !== b.vat) out.push("HT d'un côté, TTC de l'autre")
  if ((a.variantKey ?? null) !== (b.variantKey ?? null)) out.push("variantes différentes ou non précisées")
  return out
}
