/**
 * Stock of a purchased line — pure rules (no I/O), finalisation master doc G1 ("no stock decrement at purchase").
 *
 * What the stock fields really mean in this code base (read from the code, not assumed):
 * - `Product.stock` is a non-nullable Int (default 0): there is NO "unlimited" value. The PDP, the boutique and the SEO
 *   availability treat `stock <= 0` as "out of stock" — but NOT every surface does (storefront grid cards and the discover
 *   feed never read it), and a number sitting there is often NOT a maintained inventory: the Express wizard writes 99, the
 *   classic form defaults to 0, importers write 1 / 99 / 999. That is why the guard ships in `warn` mode (see below).
 * - A product with advanced SKU lines keeps one stock per line in `Product.variants.variantRows[].stock` (what the
 *   buyer sees); `Product.stock` is then the sum the supplier forms write.
 * - A product that has variants only in the `ProductVariant` TABLE (the second representation, F2: `hasVariants` and no
 *   `variantRows`) is UNMANAGED: the buyer-visible stock lives in that table, which checkout never reads or writes, so the
 *   aggregate alone would refuse in-stock variants and never move the per-variant counters.
 * - Only PHYSICAL listings have stock. Software / subscriptions / services / experiences / restaurants / museums sell
 *   without a quantity limit (bookings are limited by their slots, not by this number): they are never checked and never
 *   decremented, whatever number sits in the column.
 *
 * Conservative by design: when a line can not be tied to exactly ONE variant row of a product that has rows, nothing is
 * refused and nothing is decremented ("unmanaged") rather than guessing which row to take.
 */

import { parseListingKind } from "@/lib/supplier-commission"
import { parseCartVariantSignature } from "@/lib/cart-variant"

/**
 * Rollout switch `CHECKOUT_STOCK_MODE` = `off` | `warn` (DEFAULT) | `enforce`, read per request (flip it on Vercel, no code
 * deploy) — the same pattern as `LISTING_READINESS_MODE`.
 * - `warn`: the check before the payment only LOGS "would refuse" and lets the buyer through; the fulfilment still takes the
 *   units from the stock but never below 0, never removes a paid line and logs "would_drop" where it would have.
 * - `enforce`: the check refuses (409) and a paid line the stock can not serve becomes an unallocated line.
 * - `off`: neither check nor decrement.
 * `CHECKOUT_STOCK_GUARD=off` (or `0` / `false`) stays the emergency valve and wins over the mode.
 * Run `npm run report:checkout-stock` (read-only) before moving from `warn` to `enforce`.
 */
export type CheckoutStockMode = "off" | "warn" | "enforce"

export function resolveCheckoutStockMode(env: Record<string, string | undefined> = process.env): CheckoutStockMode {
  const guard = env.CHECKOUT_STOCK_GUARD?.trim().toLowerCase()
  if (guard === "off" || guard === "0" || guard === "false") return "off"
  const mode = env.CHECKOUT_STOCK_MODE?.trim().toLowerCase()
  if (mode === "off") return "off"
  if (mode === "enforce") return "enforce"
  return "warn"
}

/** False only when the guard is fully switched off (mode `off` or the emergency valve). */
export function isCheckoutStockGuardEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return resolveCheckoutStockMode(env) !== "off"
}

export type StockScope = "product" | "variant"

export type StockShortfallInfo = { available: number; requested: number }

export type StockPlan =
  | {
      kind: "unmanaged"
      reason: "non_physical" | "variant_unresolved" | "variants_not_tracked" | "invalid_quantity"
    }
  | { kind: "insufficient"; scope: StockScope; available: number }
  | {
      kind: "ok"
      scope: StockScope
      available: number
      /** New `Product.stock` (aggregate, never below 0). */
      nextStock: number
      /** New `Product.variants` JSON (raw, only the row's stock changed), `null` for a product-level movement. */
      nextVariants: unknown | null
      variantRowName?: string
      /** Set only with `onShortfall: "clamp"`: the stock could not serve the quantity, it was emptied instead. */
      shortfall?: StockShortfallInfo
    }

function normLabel(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase()
}

function asRawObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function rawVariantRows(variants: unknown): Array<Record<string, unknown>> {
  const obj = asRawObject(variants)
  const rows = obj?.variantRows
  if (!Array.isArray(rows)) return []
  return rows.filter((r): r is Record<string, unknown> => asRawObject(r) !== null)
}

function rawRowName(row: Record<string, unknown>): string {
  return typeof row.name === "string" ? row.name.trim() : ""
}

function rawRowStock(row: Record<string, unknown>): number {
  return typeof row.stock === "number" && Number.isFinite(row.stock) ? Math.max(0, Math.round(row.stock)) : 0
}

/** Index (in `rows`) of the ONE row the cart selection points at, or `null` when it is missing or ambiguous. */
function resolveRowIndex(rows: Array<Record<string, unknown>>, variantSignature: string | null | undefined): number | null {
  const { color, size } = parseCartVariantSignature(variantSignature ?? "")
  const c = color?.trim() ?? ""
  const s = size?.trim() ?? ""
  const label = c && s ? `${c} / ${s}` : c || s
  if (!label) return null

  const exact: number[] = []
  rows.forEach((r, i) => {
    const name = rawRowName(r)
    if (name && normLabel(name) === normLabel(label)) exact.push(i)
  })
  if (exact.length === 1) return exact[0]!
  if (exact.length > 1) return null

  // Colour only (no size picked): accept it when the product has exactly one row of that colour.
  if (c && !s) {
    const want = normLabel(c)
    const sameColor: number[] = []
    rows.forEach((r, i) => {
      const n = normLabel(rawRowName(r))
      if (n === want || n.startsWith(`${want} /`) || n.startsWith(`${want}/`)) sameColor.push(i)
    })
    if (sameColor.length === 1) return sameColor[0]!
  }
  return null
}

/**
 * Decides what buying `qty` units of a line does to the stock, from the CURRENT stock of the product.
 * The caller applies `nextStock` / `nextVariants` atomically (see `lib/checkout-stock.server.ts`).
 *
 * `onShortfall`: `refuse` (default) answers `insufficient`; `clamp` (warn mode) answers `ok` with the stock emptied (never
 * below 0) and the shortfall reported, so a paid line is never dropped.
 */
export function planStockMovement(input: {
  listingKind: string | null | undefined
  stock: number | null | undefined
  variants: unknown
  /** `Product.hasVariants`: a product with variants but no `variantRows` json keeps its stock in the ProductVariant table. */
  hasVariants?: boolean | null
  variantSignature: string | null | undefined
  qty: number
  onShortfall?: "refuse" | "clamp"
}): StockPlan {
  const qty = Math.round(Number(input.qty))
  if (!Number.isFinite(qty) || qty < 1) return { kind: "unmanaged", reason: "invalid_quantity" }
  if (parseListingKind(input.listingKind) !== "PHYSICAL") return { kind: "unmanaged", reason: "non_physical" }

  const clamp = input.onShortfall === "clamp"
  const productStock = Math.max(0, Math.round(Number(input.stock)) || 0)
  const rows = rawVariantRows(input.variants)

  if (rows.length === 0) {
    if (input.hasVariants === true) return { kind: "unmanaged", reason: "variants_not_tracked" }
    if (productStock < qty) {
      if (!clamp) return { kind: "insufficient", scope: "product", available: productStock }
      return {
        kind: "ok",
        scope: "product",
        available: productStock,
        nextStock: 0,
        nextVariants: null,
        shortfall: { available: productStock, requested: qty },
      }
    }
    return {
      kind: "ok",
      scope: "product",
      available: productStock,
      nextStock: productStock - qty,
      nextVariants: null,
    }
  }

  const index = resolveRowIndex(rows, input.variantSignature)
  if (index == null) return { kind: "unmanaged", reason: "variant_unresolved" }

  const row = rows[index]!
  const rowStock = rawRowStock(row)
  const short = rowStock < qty
  if (short && !clamp) return { kind: "insufficient", scope: "variant", available: rowStock }

  const taken = short ? rowStock : qty
  // Rewrite the RAW json (never the parsed copy: parsing normalises values and would corrupt the stored rows).
  const next = JSON.parse(JSON.stringify(asRawObject(input.variants))) as Record<string, unknown>
  const nextRows = rawVariantRows(next)
  nextRows[index]!.stock = rowStock - taken
  return {
    kind: "ok",
    scope: "variant",
    available: rowStock,
    // `Product.stock` is the supplier-maintained sum of the rows: keep it in step, never below 0.
    nextStock: Math.max(0, productStock - taken),
    nextVariants: next,
    variantRowName: rawRowName(row),
    ...(short ? { shortfall: { available: rowStock, requested: qty } } : {}),
  }
}

export type StockCheckLine = {
  productId: string
  productName?: string | null
  listingKind: string | null | undefined
  stock: number | null | undefined
  variants: unknown
  hasVariants?: boolean | null
  variantSignature: string | null | undefined
  qty: number
}

export type StockShortfall = {
  lineIndex: number
  productId: string
  productName: string | null
  scope: StockScope
  /** What the shopper could still buy of this product / variant BEFORE this cart (not what earlier lines left over). */
  available: number
  /** What this cart asks for of that same product / variant, all its lines together. */
  requested: number
}

/** Identity of the stock a line draws from: the whole product, or one variant selection of it. */
function stockScopeKey(line: StockCheckLine, scope: StockScope): string {
  if (scope === "product") return `${line.productId}|*`
  const { color, size } = parseCartVariantSignature(line.variantSignature ?? "")
  return `${line.productId}|${normLabel(color ?? "")}/${normLabel(size ?? "")}`
}

/**
 * Read-only check of a whole cart BEFORE the payment session is created. Lines that share a product (or the same
 * variant row) are consumed from the same working stock, so two lines can not each pass on their own and exceed it
 * together. Returns the first shortfall, or `null` when every managed line can be served. Advisory: the authoritative,
 * atomic decrement happens when the payment is processed.
 */
export function findCheckoutStockShortfall(lines: StockCheckLine[]): StockShortfall | null {
  const working = new Map<string, { stock: number | null | undefined; variants: unknown }>()
  /** Per product / variant row: the stock before the cart and what the cart has asked for so far. */
  const scopes = new Map<string, { original: number; requested: number }>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const state = working.get(line.productId) ?? { stock: line.stock, variants: line.variants }
    const plan = planStockMovement({
      listingKind: line.listingKind,
      stock: state.stock,
      variants: state.variants,
      hasVariants: line.hasVariants,
      variantSignature: line.variantSignature,
      qty: line.qty,
    })
    if (plan.kind === "unmanaged") continue
    const qty = Math.round(Number(line.qty))
    const scopeKey = stockScopeKey(line, plan.scope)
    if (plan.kind === "insufficient") {
      const seen = scopes.get(scopeKey)
      return {
        lineIndex: i,
        productId: line.productId,
        productName: line.productName ?? null,
        scope: plan.scope,
        available: seen?.original ?? plan.available,
        requested: (seen?.requested ?? 0) + qty,
      }
    }
    const seen = scopes.get(scopeKey) ?? { original: plan.available, requested: 0 }
    seen.requested += qty
    scopes.set(scopeKey, seen)
    working.set(line.productId, {
      stock: plan.nextStock,
      variants: plan.nextVariants ?? state.variants,
    })
  }
  return null
}

export type CheckoutStockGateDecision = {
  mode: CheckoutStockMode
  /** Set only in `enforce` mode: the checkout must be refused (409) with this shortfall. */
  refuse: StockShortfall | null
}

/**
 * The check before the payment session exists, shared by every checkout that creates one (cart, single line, agent).
 * `off`: nothing. `warn`: logs "would refuse" and lets the buyer through. `enforce`: reports the shortfall to refuse.
 */
export function evaluateCheckoutStockGate(
  lines: StockCheckLine[],
  env: Record<string, string | undefined> = process.env
): CheckoutStockGateDecision {
  const mode = resolveCheckoutStockMode(env)
  if (mode === "off") return { mode, refuse: null }
  const shortfall = findCheckoutStockShortfall(lines)
  if (!shortfall) return { mode, refuse: null }
  console.log("[checkout]", {
    result: mode === "enforce" ? "insufficient_stock" : "would_refuse_insufficient_stock",
    mode,
    productId: shortfall.productId,
    scope: shortfall.scope,
    available: shortfall.available,
    requested: shortfall.requested,
  })
  return { mode, refuse: mode === "enforce" ? shortfall : null }
}
