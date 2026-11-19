/**
 * What it COSTS a catalogue supplier to supply one unit — declared by the supplier, kept apart from everything the
 * marketplace shows or charges. Founder rule (2026-11-19): no cost is ever invented; a model (B, C1, C2) that needs a
 * source cost uses only a cost RECORDED (an AliExpress purchase) or DECLARED here, and says which.
 *
 * Not to be confused with:
 *  - the supplier's catalogue price (`Product.basePriceCents` / supplier price): what the supplier SELLS at;
 *  - the reseller's commission and selling price: set on the offer and the listing;
 *  - Affisell's fees: the category grid or a negotiated rate.
 *
 * Storage without migration (same pattern as suspensions): `AuditLog` rows the supplier writes through one route —
 *   current   `supplier-cost:<productId>`
 *   history   `supplier-cost:<productId>:<n>` (never rewritten; a simulation of an order uses the declaration in force
 *             at its payment, never a later one).
 * CONFIDENTIAL: read by the supplier who owns the product and by Affisell admins only — never by resellers, buyers or
 * other suppliers, never rendered as a product attribute. It is a DECLARATION: Affisell does not verify it.
 * Pure module — no database.
 */
export const SUPPLIER_COST_ACTION = "supplier.cost_declaration"

export const SUPPLY_SOURCES = ["own_stock", "manufacturer", "wholesaler", "dropship_source", "other"] as const
export type SupplySource = (typeof SUPPLY_SOURCES)[number]

export function supplierCostStateId(productId: string): string {
  return `supplier-cost:${productId}`
}
export function supplierCostHistoryId(productId: string, n: number): string {
  return `supplier-cost:${productId}:${n}`
}

export type SupplierCostDeclaration = {
  /** Purchase / production cost of ONE unit, HT, EUR cents. */
  unitCostCents: number
  /** What it costs the supplier to deliver one unit to a buyer, HT, EUR cents (included in its price — never charged). */
  deliveryCostCents: number
  source: SupplySource
  /** Days between an order and the goods leaving the supplier (null = not declared). */
  leadTimeDays: number | null
  /** Minimum the supplier must buy from its own source (null = none / not declared). */
  minimumOrderQty: number | null
  /** Free note for Affisell (≤ 500 chars), e.g. how the cost was computed. */
  note: string
}

export type StoredDeclaration = SupplierCostDeclaration & { declaredAt: string; declaredBy: string }

const MAX_CENTS = 10_000_000 // 100 000 € per unit: anything above is a typo, refused rather than stored.

const intIn = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null
}

export type ParseResult = { ok: true; value: SupplierCostDeclaration } | { ok: false; errors: string[] }

/** Strict validation of what the supplier sends. Nothing is guessed, defaulted to a cost, or rounded silently. */
export function parseSupplierCostInput(body: unknown): ParseResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const errors: string[] = []
  const unit = intIn(b.unitCostCents, 0, MAX_CENTS)
  if (unit === null) errors.push("unit_cost_invalid")
  const delivery = intIn(b.deliveryCostCents ?? 0, 0, MAX_CENTS)
  if (delivery === null) errors.push("delivery_cost_invalid")
  const source = typeof b.source === "string" && (SUPPLY_SOURCES as readonly string[]).includes(b.source) ? (b.source as SupplySource) : null
  if (!source) errors.push("source_invalid")
  const lead = b.leadTimeDays == null || b.leadTimeDays === "" ? null : intIn(b.leadTimeDays, 0, 365)
  if (b.leadTimeDays != null && b.leadTimeDays !== "" && lead === null) errors.push("lead_time_invalid")
  const moq = b.minimumOrderQty == null || b.minimumOrderQty === "" ? null : intIn(b.minimumOrderQty, 1, 1_000_000)
  if (b.minimumOrderQty != null && b.minimumOrderQty !== "" && moq === null) errors.push("minimum_order_invalid")
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : ""
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: { unitCostCents: unit!, deliveryCostCents: delivery!, source: source!, leadTimeDays: lead, minimumOrderQty: moq, note },
  }
}

/** Reads a stored row; anything malformed is NOT a declaration (never turned into a cost). */
export function parseStoredDeclaration(payload: unknown): StoredDeclaration | null {
  const p = (payload && typeof payload === "object" ? payload : null) as Record<string, unknown> | null
  if (!p || typeof p.declaredAt !== "string" || typeof p.declaredBy !== "string") return null
  const parsed = parseSupplierCostInput(p)
  if (!parsed.ok) return null
  return { ...parsed.value, declaredAt: p.declaredAt, declaredBy: p.declaredBy }
}

/** Total cost of supplying one unit to a buyer, as declared. */
export function declaredSourceCostCents(d: SupplierCostDeclaration): number {
  return d.unitCostCents + d.deliveryCostCents
}

/**
 * The declaration in force at `at` (an order's payment): the latest one declared at or before it. A declaration made
 * AFTER the payment never applies to that order (no retroactive cost).
 */
export function declarationInForceAt<T extends StoredDeclaration>(history: ReadonlyArray<T>, at: Date): T | null {
  let best: T | null = null
  for (const d of history) {
    const t = Date.parse(d.declaredAt)
    if (!Number.isFinite(t) || t > at.getTime()) continue
    if (!best || t > Date.parse(best.declaredAt)) best = d
  }
  return best
}

/** Coherence hints shown to the supplier (never blocking: the supplier knows its costs). */
export function declarationWarnings(d: SupplierCostDeclaration, supplierPriceCents: number | null): string[] {
  const w: string[] = []
  if (supplierPriceCents != null && supplierPriceCents > 0 && declaredSourceCostCents(d) > supplierPriceCents) {
    w.push("cost_above_supplier_price")
  }
  if (d.unitCostCents === 0) w.push("unit_cost_zero")
  return w
}
