/**
 * What a RESELLER really receives per sale — the figure the catalogue must show. Pure and client-safe.
 *
 * Mirrors the settlement cent for cent (`computeMarketplaceOrderSettlement` + `computePhase1OrderFees` +
 * `netAffiliateTransferCents`), the same way `supplier-earning-preview.ts` mirrors it for suppliers:
 *
 *     commission = round(supplier price × commission%)   — paid by the supplier, out of its price
 *     markup     = selling price HT − supplier price      — the reseller's own margin (0 when priced below)
 *     gross      = commission + markup
 *     fee        = round(gross × fee bps / 10 000)       — Affisell's reseller-side fee (the reseller's negotiated
 *                                                          `User.affiliatePlatformFeeBps`, else the default 20 %)
 *     net        = gross − fee                           — what the transfer pays
 *
 * Before this module the catalogue headline « Revenu revendeur estimé » was `gross`: the fee taken at payout was not
 * shown, so every card overstated what the reseller is paid. A test compares this module with the real settlement
 * functions over a grid, so it cannot drift.
 *
 * Data qualification (founder rule): supplier price and commission are the supplier's CATALOGUE terms (declared,
 * contractual for the sale); the selling price is the reseller's own (or a suggestion); the net is a CALCULATION of
 * those terms — never a promise of sales. The buyer's TTC price is an ESTIMATE (Stripe Tax decides the rate at checkout).
 */
import { DEFAULT_AFFILIATE_PLATFORM_FEE_BPS, resolveAffiliatePlatformFeeBps } from "@/lib/marketplace-phase1-fees"

export type ResellerNetInput = {
  supplierPriceCents: number
  /** `Product.commissionRate`, percent of the supplier price (as stored). */
  commissionRatePct: number
  /** The reseller's selling price, HT (what checkout charges before VAT). */
  sellingPriceHtCents: number
  /** The reseller's own rate (`User.affiliatePlatformFeeBps`); null = not set → the platform default. */
  affiliateFeeBps: number | null
}

export type ResellerNet = {
  sellingPriceHtCents: number
  commissionCents: number
  markupCents: number
  grossCents: number
  affisellFeeCents: number
  netCents: number
  feeBps: number
  /** True when the reseller has no negotiated rate and the platform default was used. */
  feeIsDefault: boolean
  /** The selling price is under the supplier's price: no markup, the commission alone remains. */
  belowSupplierPrice: boolean
  /** ESTIMATE of what the buyer pays at the French standard rate (20 %); Stripe Tax decides the real rate. */
  buyerPriceTtcEstimateCents: number
}

export const BUYER_VAT_ESTIMATE_BPS = 2000

const cents = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0)

export function computeResellerNetPerSale(input: ResellerNetInput): ResellerNet {
  const supplier = cents(input.supplierPriceCents)
  const selling = cents(input.sellingPriceHtCents)
  const pct = Number.isFinite(input.commissionRatePct) ? Math.min(100, Math.max(0, input.commissionRatePct)) : 0
  const commissionBps = Math.round(pct * 100)
  const commissionCents = Math.round((supplier * commissionBps) / 10_000)
  const markupCents = Math.max(0, selling - supplier)
  const grossCents = commissionCents + markupCents
  const feeIsDefault = input.affiliateFeeBps == null || !Number.isFinite(input.affiliateFeeBps)
  const feeBps = resolveAffiliatePlatformFeeBps(feeIsDefault ? null : input.affiliateFeeBps)
  const affisellFeeCents = Math.round((grossCents * feeBps) / 10_000)
  return {
    sellingPriceHtCents: selling,
    commissionCents,
    markupCents,
    grossCents,
    affisellFeeCents,
    netCents: Math.max(0, grossCents - affisellFeeCents),
    feeBps,
    feeIsDefault,
    belowSupplierPrice: selling > 0 && selling < supplier,
    buyerPriceTtcEstimateCents: Math.round((selling * (10_000 + BUYER_VAT_ESTIMATE_BPS)) / 10_000),
  }
}

export { DEFAULT_AFFILIATE_PLATFORM_FEE_BPS }
