/**
 * RESELLER COPILOT — « sélection prête à vendre » (innovation 1 of the 2026-11-19 cycle). Pure.
 *
 * The friction it removes (read in the code, not assumed): to choose what to sell, a reseller had to open product
 * after product, work out by hand what a sale would really pay (the catalogue headline left out Affisell's reseller fee
 * and showed an HT price as the « client price »), and could add a product that can not be sold at all — out of stock,
 * or with no explicit commission, in which case the buyer pays and the line is NOT turned into an order
 * (`commission_not_explicit`, lib/unallocated-line.ts). The copilot does that work for the whole catalogue at once:
 * every candidate gets the REAL net per sale (net-per-sale.ts, pinned to the settlement), a readiness verdict with its
 * reasons, and the observed demand — then the reseller adds the ones it keeps in one action.
 *
 * Every figure says what it is (founder rule): `catalogue` = the supplier's published terms (declared, contractual for
 * the sale); `calcul` = computed from those terms; `observe` = counted in Affisell's own paid orders; nothing is a
 * forecast — no « you will earn X per month » is ever produced.
 */
import { computeResellerNetPerSale, type ResellerNet } from "@/lib/reseller-copilot/net-per-sale"

export type Qualification = "catalogue" | "calcul" | "observe" | "suggestion"

export type SelectionCandidate = {
  productId: string
  name: string
  imageUrl: string | null
  basePriceCents: number
  /** Commission % in force for the product line (explicitSupplierCommissionPct, product default). */
  commissionRatePct: number
  /** True when checkout would accept the line (`productHasExplicitSupplierCommission`). */
  commissionExplicit: boolean
  /** Units on hand: product stock, or the sum of the variant rows when the stock lives there. */
  stockUnits: number
  /** False when the stock can not be read reliably (variants only in the table, etc.). */
  stockKnown: boolean
  /** Return window offered (14 = legal minimum). */
  returnWindowDays: number
  /** Paid orders of the product on the whole marketplace, last 30 days. */
  paidOrders30d: number
  /** Resellers that already list it. */
  resellersListing: number
  /** Already in this reseller's shop. */
  inMyShop: boolean
  /** A reseller URL import not yet reviewed by Affisell — can not be listed. */
  awaitingReview: boolean
}

export type Reason = { code: string; qualification: Qualification }

export type SelectionItem = {
  productId: string
  name: string
  imageUrl: string | null
  readiness: "pret" | "a_verifier" | "bloque"
  reasons: Reason[]
  suggestedPriceHtCents: number
  net: ResellerNet
  demand: { paidOrders30d: number; resellersListing: number; qualification: "observe" }
  returnWindowDays: number
}

/** Same default as the existing quick add (lib/affiliate-catalog-margin-display.ts): supplier price + 30 %. */
export const SUGGESTED_MARKUP_RATE = 0.3
/** A sale paying less than this, net, is not worth the reseller's effort: kept, flagged. */
export const LOW_NET_CENTS = 200
/** Very few units: the product may run out right after it is promoted. */
export const LOW_STOCK_UNITS = 3

export function suggestedPriceHt(basePriceCents: number, markupRate = SUGGESTED_MARKUP_RATE): number {
  const base = Math.max(0, Math.round(basePriceCents))
  return Math.max(base, Math.round(base * (1 + markupRate)))
}

export function assessCandidate(c: SelectionCandidate, affiliateFeeBps: number | null): SelectionItem {
  const price = suggestedPriceHt(c.basePriceCents)
  const net = computeResellerNetPerSale({
    supplierPriceCents: c.basePriceCents,
    commissionRatePct: c.commissionRatePct,
    sellingPriceHtCents: price,
    affiliateFeeBps,
  })
  const blocked: Reason[] = []
  const check: Reason[] = []
  const info: Reason[] = []
  if (c.awaitingReview) blocked.push({ code: "awaiting_affisell_review", qualification: "catalogue" })
  if (!c.commissionExplicit) blocked.push({ code: "no_explicit_commission", qualification: "catalogue" })
  if (c.basePriceCents <= 0) blocked.push({ code: "no_supplier_price", qualification: "catalogue" })
  if (c.stockKnown && c.stockUnits <= 0) blocked.push({ code: "out_of_stock", qualification: "catalogue" })
  if (!c.stockKnown) check.push({ code: "stock_unknown", qualification: "catalogue" })
  else if (c.stockUnits > 0 && c.stockUnits <= LOW_STOCK_UNITS) check.push({ code: "low_stock", qualification: "catalogue" })
  if (blocked.length === 0 && net.netCents < LOW_NET_CENTS) check.push({ code: "low_net_per_sale", qualification: "calcul" })
  if (net.feeIsDefault) info.push({ code: "standard_affisell_fee", qualification: "catalogue" })
  if (c.returnWindowDays > 14) info.push({ code: "extended_returns", qualification: "catalogue" })
  if (c.paidOrders30d > 0) info.push({ code: "already_selling", qualification: "observe" })
  else info.push({ code: "no_sales_observed", qualification: "observe" })
  return {
    productId: c.productId,
    name: c.name,
    imageUrl: c.imageUrl,
    readiness: blocked.length ? "bloque" : check.length ? "a_verifier" : "pret",
    reasons: [...blocked, ...check, ...info],
    suggestedPriceHtCents: price,
    net,
    demand: { paidOrders30d: Math.max(0, c.paidOrders30d), resellersListing: Math.max(0, c.resellersListing), qualification: "observe" },
    returnWindowDays: c.returnWindowDays,
  }
}

const RANK = { pret: 0, a_verifier: 1, bloque: 2 } as const

/**
 * The selection: products not yet in the reseller's shop, ready first, then to check; within each, the highest real
 * net per sale first, then the most observed demand. Blocked products are returned apart (with their reasons) so the
 * reseller understands why a product is missing — never mixed into the selection.
 */
export function buildSelection(
  candidates: ReadonlyArray<SelectionCandidate>,
  opts: { affiliateFeeBps: number | null; limit: number }
): { selection: SelectionItem[]; blocked: SelectionItem[]; considered: number; alreadyInShop: number } {
  const fresh = candidates.filter((c) => !c.inMyShop)
  const assessed = fresh.map((c) => assessCandidate(c, opts.affiliateFeeBps))
  const ok = assessed
    .filter((a) => a.readiness !== "bloque")
    .sort(
      (a, b) =>
        RANK[a.readiness] - RANK[b.readiness] ||
        b.net.netCents - a.net.netCents ||
        b.demand.paidOrders30d - a.demand.paidOrders30d ||
        a.productId.localeCompare(b.productId)
    )
  const limit = Math.max(1, Math.min(50, Math.floor(opts.limit)))
  return {
    selection: ok.slice(0, limit),
    blocked: assessed.filter((a) => a.readiness === "bloque").slice(0, limit),
    considered: candidates.length,
    alreadyInShop: candidates.length - fresh.length,
  }
}

/** Ids a reseller may add in one action: only items the selection itself proposed (never a blocked product). */
export function sanitizeAddRequest(body: unknown, max = 20): string[] | null {
  const ids = (body && typeof body === "object" ? (body as { productIds?: unknown }).productIds : null) as unknown
  if (!Array.isArray(ids)) return null
  const clean = [...new Set(ids.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)))]
  if (clean.length === 0 || clean.length > max) return null
  return clean
}
