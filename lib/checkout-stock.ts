/**
 * Stock of a purchased line — pure rules (no I/O), finalisation master doc G1 ("no stock decrement at purchase").
 *
 * What the stock fields really mean in this code base (read from the code, not assumed):
 * - `Product.stock` is a non-nullable Int (default 0): there is NO "unlimited" value. Every buyer surface treats
 *   `stock <= 0` as "out of stock" (PDP, boutique, SEO availability), so 0 means sold out, not "not tracked".
 * - A product with advanced SKU lines keeps one stock per line in `Product.variants.variantRows[].stock` (what the
 *   buyer sees); `Product.stock` is then the sum the supplier forms write. The `ProductVariant` table is a second
 *   representation (F2) that checkout and fulfilment never read — it is left alone.
 * - Only PHYSICAL listings have stock. Software / subscriptions / services / experiences / restaurants / museums sell
 *   without a quantity limit (bookings are limited by their slots, not by this number): they are never checked and never
 *   decremented, whatever number sits in the column (the wizard writes 99 as a placeholder there).
 *
 * Conservative by design: when a line can not be tied to exactly ONE variant row of a product that has rows, nothing is
 * refused and nothing is decremented ("unmanaged") rather than guessing which row to take.
 */

import { parseListingKind } from "@/lib/supplier-commission"
import { parseCartVariantSignature } from "@/lib/cart-variant"

/**
 * Emergency valve: `CHECKOUT_STOCK_GUARD=off` (or `0` / `false`) disables BOTH the check before the payment and the
 * decrement after it, with no code deploy. Anything else (including unset) keeps the guard on. Read per call.
 */
export function isCheckoutStockGuardEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.CHECKOUT_STOCK_GUARD?.trim().toLowerCase()
  return !(v === "off" || v === "0" || v === "false")
}

export type StockScope = "product" | "variant"

export type StockPlan =
  | { kind: "unmanaged"; reason: "non_physical" | "variant_unresolved" | "invalid_quantity" }
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
 */
export function planStockMovement(input: {
  listingKind: string | null | undefined
  stock: number | null | undefined
  variants: unknown
  variantSignature: string | null | undefined
  qty: number
}): StockPlan {
  const qty = Math.round(Number(input.qty))
  if (!Number.isFinite(qty) || qty < 1) return { kind: "unmanaged", reason: "invalid_quantity" }
  if (parseListingKind(input.listingKind) !== "PHYSICAL") return { kind: "unmanaged", reason: "non_physical" }

  const productStock = Math.max(0, Math.round(Number(input.stock)) || 0)
  const rows = rawVariantRows(input.variants)

  if (rows.length === 0) {
    if (productStock < qty) return { kind: "insufficient", scope: "product", available: productStock }
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

export type StockCheckLine = {
  productId: string
  productName?: string | null
  listingKind: string | null | undefined
  stock: number | null | undefined
  variants: unknown
  variantSignature: string | null | undefined
  qty: number
}

export type StockShortfall = {
  lineIndex: number
  productId: string
  productName: string | null
  scope: StockScope
  available: number
  requested: number
}

/**
 * Read-only check of a whole cart BEFORE the payment session is created. Lines that share a product are consumed from
 * the same working stock, so two lines of the same product can not each pass on their own and exceed it together.
 * Returns the first shortfall, or `null` when every managed line can be served. Advisory: the authoritative, atomic
 * decrement happens when the payment is processed.
 */
export function findCheckoutStockShortfall(lines: StockCheckLine[]): StockShortfall | null {
  const working = new Map<string, { stock: number | null | undefined; variants: unknown }>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const state = working.get(line.productId) ?? { stock: line.stock, variants: line.variants }
    const plan = planStockMovement({
      listingKind: line.listingKind,
      stock: state.stock,
      variants: state.variants,
      variantSignature: line.variantSignature,
      qty: line.qty,
    })
    if (plan.kind === "insufficient") {
      return {
        lineIndex: i,
        productId: line.productId,
        productName: line.productName ?? null,
        scope: plan.scope,
        available: plan.available,
        requested: Math.round(Number(line.qty)),
      }
    }
    if (plan.kind === "ok") {
      working.set(line.productId, {
        stock: plan.nextStock,
        variants: plan.nextVariants ?? state.variants,
      })
    }
  }
  return null
}
