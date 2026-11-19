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

export type StoredDeclaration = SupplierCostDeclaration & {
  declaredAt: string
  declaredBy: string
  /**
   * Date from which the declaration applies (ISO). Never before `declaredAt` (no retroactive cost); may be later (a
   * supplier announcing a cost change). Older rows have none: they apply from `declaredAt`.
   */
  effectiveFrom?: string
  /** Variant the declaration is for (canonical key, variant-key.ts); null / absent = the whole product. */
  variantKey?: string | null
  variantLabel?: string | null
}

/**
 * Per-variant declarations (founder rule 2026-11-19) — same fields, their own rows so a product-wide reader can never
 * mistake one for the product's cost:
 *   `supplier-cost-v:<productId>:<n>` (n counts every variant declaration of the product, never rewritten; no
 *   "current" row: the current declaration of a variant is its latest row).
 * Their qualification events use `VARIANT_COST_QUALIFICATION_ACTION` and `supplier-cost-vq:<productId>:<n>:<k>`.
 */
export const VARIANT_COST_ACTION = "supplier.cost_declaration_variant"
export function variantCostHistoryId(productId: string, n: number): string {
  return `supplier-cost-v:${productId}:${n}`
}

/** When a declaration starts to apply. */
export function declarationEffectiveAt(d: Pick<StoredDeclaration, "declaredAt" | "effectiveFrom">): number {
  const e = d.effectiveFrom ? Date.parse(d.effectiveFrom) : Number.NaN
  return Number.isFinite(e) ? e : Date.parse(d.declaredAt)
}

export const MAX_EFFECTIVE_AHEAD_DAYS = 365

/**
 * The effective date a supplier asks for: absent = now; else an ISO date between now (5 minutes of clock tolerance) and
 * one year ahead. A date in the past is REFUSED (it would rewrite the cost of orders already paid).
 */
export function parseEffectiveFrom(raw: unknown, now: Date): { ok: true; value: string } | { ok: false; error: "effective_from_invalid" | "effective_from_in_past" | "effective_from_too_far" } {
  if (raw == null || raw === "") return { ok: true, value: now.toISOString() }
  if (typeof raw !== "string") return { ok: false, error: "effective_from_invalid" }
  const t = Date.parse(raw)
  if (!Number.isFinite(t)) return { ok: false, error: "effective_from_invalid" }
  if (t < now.getTime() - 5 * 60_000) return { ok: false, error: "effective_from_in_past" }
  if (t > now.getTime() + MAX_EFFECTIVE_AHEAD_DAYS * 86_400_000) return { ok: false, error: "effective_from_too_far" }
  return { ok: true, value: new Date(Math.max(t, now.getTime())).toISOString() }
}

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
  const declaredAtMs = Date.parse(p.declaredAt)
  if (!Number.isFinite(declaredAtMs)) return null
  // An effective date before the declaration would be retroactive: such a row is not trusted as a declaration.
  let effectiveFrom: string | undefined
  if (p.effectiveFrom !== undefined) {
    const e = typeof p.effectiveFrom === "string" ? Date.parse(p.effectiveFrom) : Number.NaN
    if (!Number.isFinite(e) || e < declaredAtMs) return null
    effectiveFrom = p.effectiveFrom as string
  }
  const variantKey = typeof p.variantKey === "string" && p.variantKey.length > 0 ? p.variantKey : null
  return {
    ...parsed.value,
    declaredAt: p.declaredAt,
    declaredBy: p.declaredBy,
    ...(effectiveFrom ? { effectiveFrom } : {}),
    variantKey,
    variantLabel: variantKey && typeof p.variantLabel === "string" ? p.variantLabel : null,
  }
}

/** Total cost of supplying one unit to a buyer, as declared. */
export function declaredSourceCostCents(d: SupplierCostDeclaration): number {
  return d.unitCostCents + d.deliveryCostCents
}

/**
 * The declaration in force at `at` (an order's payment): among those whose effective date is at or before `at`, the one
 * with the latest effective date (ties: the latest declared). A declaration effective AFTER the payment never applies to
 * that order (no retroactive cost). The caller passes ONE scope (the product's, or one variant's) — never both mixed.
 */
export function declarationInForceAt<T extends StoredDeclaration>(history: ReadonlyArray<T>, at: Date): T | null {
  let best: T | null = null
  for (const d of history) {
    const t = declarationEffectiveAt(d)
    if (!Number.isFinite(t) || t > at.getTime()) continue
    if (!best) {
      best = d
      continue
    }
    const bt = declarationEffectiveAt(best)
    if (t > bt || (t === bt && Date.parse(d.declaredAt) > Date.parse(best.declaredAt))) best = d
  }
  return best
}

export type ResolvedLineCost<T extends StoredDeclaration> =
  | { scope: "variant"; declaration: T; note: string }
  | { scope: "product"; declaration: T; note: string }
  | { scope: "none"; declaration: null; note: string }

/**
 * Which declaration describes the cost of ONE order line, paid at `at`:
 *  1. the line's OWN variant declaration in force (exact canonical key) — never another variant's;
 *  2. else the product-wide declaration in force (the supplier's default for every variant without its own);
 *  3. else none.
 * A line without a variant never takes a variant's declaration.
 */
export function resolveDeclarationForLine<T extends StoredDeclaration>(args: {
  productHistory: ReadonlyArray<T>
  variantHistory: ReadonlyArray<T>
  variantKey: string | null
  at: Date
}): ResolvedLineCost<T> {
  if (args.variantKey) {
    const own = declarationInForceAt(
      args.variantHistory.filter((d) => d.variantKey === args.variantKey),
      args.at
    )
    if (own) return { scope: "variant", declaration: own, note: "déclaration propre à la variante" }
  }
  const global = declarationInForceAt(
    args.productHistory.filter((d) => !d.variantKey),
    args.at
  )
  if (global) {
    return {
      scope: "product",
      declaration: global,
      note: args.variantKey ? "déclaration globale du produit (aucune déclaration propre à cette variante en vigueur)" : "déclaration globale du produit",
    }
  }
  return { scope: "none", declaration: null, note: "aucune déclaration en vigueur à cette date" }
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
