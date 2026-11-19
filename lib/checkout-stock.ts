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
import { resolveVariantChoice, type VariantChoiceResolution, type VariantDimension } from "@/lib/variant-selection"

/**
 * Rollout switch `CHECKOUT_STOCK_MODE` = `off` | `warn` (DEFAULT) | `enforce`, read per request (flip it on Vercel, no code
 * deploy) — the same pattern as `LISTING_READINESS_MODE`.
 * - `warn`: a pure DRY RUN. The check before the payment only LOGS "would refuse" and lets the buyer through; the
 *   fulfilment WRITES NOTHING to the stock (no decrement, no row lock — `Product.stock` is what the PDP / showcase card /
 *   JSON-LD read as "sold out", so a write would already change what shoppers see), computes what it would have done and
 *   logs it (`[stock] would_decrement` with before / after, `would_drop` when the stock could not serve a paid line). It
 *   never removes a paid line.
 * - `enforce`: the check refuses (409), the fulfilment decrements atomically and a paid line the stock can not serve
 *   becomes an unallocated line.
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
/**
 * The row a line draws from — the SHARED rule of `lib/variant-selection.ts` (same as the product pages and the check
 * before payment). `null` = no single row can be told: the line is not managed (never decremented, never guessed).
 */
function resolveVariantLine(variants: unknown, variantSignature: string | null | undefined): VariantChoiceResolution {
  const { color, size, storage } = parseCartVariantSignature(variantSignature ?? "")
  return resolveVariantChoice(variants, { color, size, storage })
}

/**
 * Decides what buying `qty` units of a line does to the stock, from the CURRENT stock of the product.
 * The caller applies `nextStock` / `nextVariants` atomically (see `lib/checkout-stock.server.ts`).
 */
export function planStockMovement(input: {
  listingKind: string | null | undefined
  stock: number | null | undefined
  variants: unknown
  /** `Product.hasVariants`: a product with variants but no `variantRows` json keeps its stock in the ProductVariant table. */
  hasVariants?: boolean | null
  variantSignature: string | null | undefined
  qty: number
}): StockPlan {
  const qty = Math.round(Number(input.qty))
  if (!Number.isFinite(qty) || qty < 1) return { kind: "unmanaged", reason: "invalid_quantity" }
  if (parseListingKind(input.listingKind) !== "PHYSICAL") return { kind: "unmanaged", reason: "non_physical" }

  const productStock = Math.max(0, Math.round(Number(input.stock)) || 0)
  const rows = rawVariantRows(input.variants)

  if (rows.length === 0) {
    if (input.hasVariants === true) return { kind: "unmanaged", reason: "variants_not_tracked" }
    if (productStock < qty) return { kind: "insufficient", scope: "product", available: productStock }
    return {
      kind: "ok",
      scope: "product",
      available: productStock,
      nextStock: productStock - qty,
      nextVariants: null,
    }
  }

  const resolution = resolveVariantLine(input.variants, input.variantSignature)
  if (resolution.kind !== "resolved") return { kind: "unmanaged", reason: "variant_unresolved" }
  const index = resolution.index

  const row = rows[index]!
  const rowStock = rawRowStock(row)
  if (rowStock < qty) return { kind: "insufficient", scope: "variant", available: rowStock }

  // Rewrite the RAW json (never the parsed copy: parsing normalises values and would corrupt the stored rows).
  const next = JSON.parse(JSON.stringify(asRawObject(input.variants))) as Record<string, unknown>
  const nextRows = rawVariantRows(next)
  nextRows[index]!.stock = rowStock - qty
  return {
    kind: "ok",
    scope: "variant",
    available: rowStock,
    // `Product.stock` is the supplier-maintained sum of the rows: keep it in step, never below 0.
    nextStock: Math.max(0, productStock - qty),
    nextVariants: next,
    variantRowName: rawRowName(row),
  }
}

export type StockRestitutionPlan =
  | { kind: "skip"; reason: "invalid_quantity" | "variant_row_gone" | "variant_row_ambiguous" | "not_variant_rows" }
  | { kind: "ok"; scope: StockScope; nextStock: number; nextVariants: unknown | null }

/**
 * Gives back `qty` units a reservation took (`planStockMovement`, applied by `reserveStockInTransaction` in `enforce`).
 * A variant reservation is given back to the row of the SAME name; if that row no longer exists (or the name is now
 * ambiguous) nothing is given back — under-selling is safe, crediting the wrong row is not. Pure; the caller applies
 * the result under the product row lock (`lib/stock-restitution.server.ts`).
 */
export function planStockRestitution(input: {
  stock: number | null | undefined
  variants: unknown
  scope: StockScope
  variantRowName?: string | null
  qty: number
}): StockRestitutionPlan {
  const qty = Math.round(Number(input.qty))
  if (!Number.isFinite(qty) || qty < 1) return { kind: "skip", reason: "invalid_quantity" }
  const productStock = Math.max(0, Math.round(Number(input.stock)) || 0)

  if (input.scope === "product") {
    return { kind: "ok", scope: "product", nextStock: productStock + qty, nextVariants: null }
  }

  const rows = rawVariantRows(input.variants)
  if (rows.length === 0) return { kind: "skip", reason: "not_variant_rows" }
  const want = normLabel(input.variantRowName ?? "")
  if (!want) return { kind: "skip", reason: "variant_row_gone" }
  const matches: number[] = []
  rows.forEach((r, i) => {
    if (normLabel(rawRowName(r)) === want) matches.push(i)
  })
  if (matches.length === 0) return { kind: "skip", reason: "variant_row_gone" }
  if (matches.length > 1) return { kind: "skip", reason: "variant_row_ambiguous" }

  const next = JSON.parse(JSON.stringify(asRawObject(input.variants))) as Record<string, unknown>
  const nextRows = rawVariantRows(next)
  const row = nextRows[matches[0]!]!
  row.stock = rawRowStock(row) + qty
  return { kind: "ok", scope: "variant", nextStock: productStock + qty, nextVariants: next }
}

/**
 * Whether a line draws from a managed stock at all, judged on what is known WITHOUT reading the live stock (kind, variant
 * structure, selection). Lets the fulfilment skip the row lock of a product that can only come out "unmanaged" (digital,
 * table-only variants, unresolvable variant) instead of locking it for nothing. A snapshot read earlier is enough: none of
 * these facts changes between the listing load and the lock in any way that matters.
 */
export function isStockManagedForLine(input: {
  listingKind: string | null | undefined
  hasVariants?: boolean | null
  variants: unknown
  variantSignature: string | null | undefined
}): boolean {
  return (
    planStockMovement({
      listingKind: input.listingKind,
      stock: Number.MAX_SAFE_INTEGER,
      variants: input.variants,
      hasVariants: input.hasVariants,
      variantSignature: input.variantSignature,
      qty: 1,
    }).kind !== "unmanaged"
  )
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
  // The row itself: two spellings of one variant (« Noir · 128 Go » in the size slot or as storage) share its stock.
  const r = resolveVariantLine(line.variants, line.variantSignature)
  if (r.kind === "resolved") return `${line.productId}|row:${r.index}`
  const { color, size, storage } = parseCartVariantSignature(line.variantSignature ?? "")
  return `${line.productId}|${normLabel(color ?? "")}/${normLabel(size ?? "")}/${normLabel(storage ?? "")}`
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
  /** Set only in `enforce` mode: a line asks for a variant the product does not have (409 `VARIANT_UNAVAILABLE`). */
  refuseVariant: VariantSelectionRefusal | null
}

export type VariantSelectionProblem = "variant_unknown" | "variant_incomplete" | "variant_required"

export type VariantSelectionRefusal = {
  lineIndex: number
  productId: string
  productName: string | null
  problem: VariantSelectionProblem
  /** `variant_incomplete` / `variant_required`: the dimensions the buyer still has to choose. */
  missing?: VariantDimension[]
}

/**
 * Does the buyer's choice name ONE variant the product really has (founder briefs 2026-11-19)? The shared rule of
 * `lib/variant-selection.ts` — the same one the decrement uses, so a line passing this check is a line the decrement
 * can tie to its row:
 *  - `variant_unknown`: the combination does not exist (a size of another colour, a renamed row, a forged request);
 *  - `variant_incomplete`: a choice that leaves several rows (a colour alone on a product sold in several sizes);
 *  - `variant_required`: no choice at all while the product has several variants.
 * Never flagged: products without rows (no variants, or variants only in the `ProductVariant` table — their stock is
 * not held per variant), a product with a single row, rows identical on every dimension (the supplier's data), and
 * non-physical goods. Pure.
 */
export function variantSelectionProblem(input: {
  listingKind: string | null | undefined
  variants: unknown
  variantSignature: string | null | undefined
}): { problem: VariantSelectionProblem; missing?: VariantDimension[] } | null {
  if (parseListingKind(input.listingKind) !== "PHYSICAL") return null
  const r = resolveVariantLine(input.variants, input.variantSignature)
  if (r.kind === "unknown") return { problem: "variant_unknown" }
  if (r.kind !== "incomplete") return null
  const { color, size, storage } = parseCartVariantSignature(input.variantSignature ?? "")
  const chose = Boolean(color?.trim() || size?.trim() || storage?.trim())
  return { problem: chose ? "variant_incomplete" : "variant_required", missing: r.missing }
}

/** Names of the rows the buyer can still choose (stock > 0) — what a refusal offers instead. Public on the PDP already. */
export function availableVariantLabels(variants: unknown, max = 12): string[] {
  return rawVariantRows(variants)
    .filter((r) => rawRowStock(r) > 0)
    .map(rawRowName)
    .filter(Boolean)
    .slice(0, max)
}

/** First line of a cart whose variant choice is not a variant of the product (see `variantSelectionProblem`). */
export function findVariantSelectionRefusal(lines: StockCheckLine[]): VariantSelectionRefusal | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const found = variantSelectionProblem(line)
    if (found) {
      return {
        lineIndex: i,
        productId: line.productId,
        productName: line.productName ?? null,
        problem: found.problem,
        ...(found.missing ? { missing: found.missing } : {}),
      }
    }
  }
  return null
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
  if (mode === "off") return { mode, refuse: null, refuseVariant: null }
  const variant = findVariantSelectionRefusal(lines)
  if (variant) {
    console.log("[checkout]", {
      result: mode === "enforce" ? variant.problem : `would_refuse_${variant.problem}`,
      mode,
      productId: variant.productId,
      missing: variant.missing ?? null,
    })
    if (mode === "enforce") return { mode, refuse: null, refuseVariant: variant }
  }
  const shortfall = findCheckoutStockShortfall(lines)
  if (!shortfall) return { mode, refuse: null, refuseVariant: null }
  console.log("[checkout]", {
    result: mode === "enforce" ? "insufficient_stock" : "would_refuse_insufficient_stock",
    mode,
    productId: shortfall.productId,
    scope: shortfall.scope,
    available: shortfall.available,
    requested: shortfall.requested,
  })
  return { mode, refuse: mode === "enforce" ? shortfall : null, refuseVariant: null }
}
