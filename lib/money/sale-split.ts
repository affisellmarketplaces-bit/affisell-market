/**
 * Canonical Affisell sale split — the ONE place the money model is defined.
 *
 *  - The supplier sets the wholesale price W and the commission offered to resellers (bps of W).
 *  - Affisell takes a CATEGORY-based commission from the supplier side, on the wholesale price W.
 *  - The reseller adds a markup M on top of W. The buyer pays W + M (HT).
 *  - The reseller earns the offered commission + the markup (HT), and Affisell takes a flat
 *    20 % of that HT net.
 *
 *      supplier  = W − commission − supplierFee
 *      reseller  = (commission + M) − resellerFee
 *      platform  = supplierFee + resellerFee
 *      Σ         = W + M         (exact, integer cents — no drift, ever)
 *
 * Pure, integer cents, no I/O. Every caller (checkout, payment finalisation, VAT sync,
 * transfer scheduler) must derive money from this function so that no two code paths can
 * disagree.
 */

/** Flat Affisell commission on the reseller's HT net (commission + markup). */
export const RESELLER_PLATFORM_FEE_BPS = 2000

/** Auto-buy service surcharge on top of the category rate (historical gap 17 % − 10 %). */
export const AUTO_BUY_SUPPLIER_FEE_SURCHARGE_BPS = 700

const MAX_BPS = 5000

const int = (n: number | null | undefined): number =>
  Math.round(Number.isFinite(n ?? NaN) ? (n as number) : 0)
const pos = (n: number | null | undefined): number => Math.max(0, int(n))
const bps = (n: number | null | undefined): number => Math.min(MAX_BPS, pos(n))

export type SaleSplitInput = {
  /** Supplier wholesale for the whole line (HT). */
  wholesaleCents: number
  /** Commission offered by the supplier, bps of the wholesale price. */
  commissionBps: number
  /**
   * Reseller markup for the whole line (HT): the fixed listing margin, or `H − W` when the
   * listing has none. Use {@link resolveLineMarkupCents}.
   */
  markupCents: number
  /** Affisell commission on the supplier side, bps of {@link supplierFeeBaseCents}. */
  supplierFeeBps: number
  /** Base of the supplier-side commission. Defaults to the wholesale price. */
  supplierFeeBaseCents?: number | null
  /** Affisell commission on the reseller's HT net. Defaults to 20 %. */
  resellerFeeBps?: number | null
  /** HT amount actually collected for the line (after flash discount / store credit). */
  collectedHtCents?: number | null
}

export type SaleSplit = {
  wholesaleCents: number
  commissionCents: number
  markupCents: number
  supplierFeeCents: number
  supplierPayoutCents: number
  /** Reseller HT net before the Affisell fee: commission + markup. */
  resellerGrossCents: number
  resellerFeeCents: number
  resellerPayoutCents: number
  /** Affisell take: supplierFee + resellerFee. */
  platformFeeCents: number
  /** Undiscounted HT price the buyer would pay: W + M. */
  listPriceHtCents: number
  /** Part of the partners' payouts funded by Affisell when the collected amount is lower. */
  platformSubsidyCents: number
}

/** Markup of a line: the fixed listing margin, otherwise the collected HT above wholesale. */
export function resolveLineMarkupCents(args: {
  collectedHtCents: number
  wholesaleCents: number
  fixedListingMarginCents?: number | null
}): number {
  const fixed = pos(args.fixedListingMarginCents)
  if (fixed > 0) return fixed
  return Math.max(0, pos(args.collectedHtCents) - pos(args.wholesaleCents))
}

/** Supplier-side Affisell rate: category rate, plus the auto-buy service surcharge when used. */
export function supplierFeeBpsForCategory(args: {
  categoryBps: number
  usesAffisellAutoBuy?: boolean | null
}): number {
  return bps(bps(args.categoryBps) + (args.usesAffisellAutoBuy ? AUTO_BUY_SUPPLIER_FEE_SURCHARGE_BPS : 0))
}

export function computeSaleSplit(input: SaleSplitInput): SaleSplit {
  const wholesale = pos(input.wholesaleCents)
  const markup = pos(input.markupCents)

  const commissionCents = Math.min(wholesale, Math.round((wholesale * bps(input.commissionBps)) / 10_000))

  const feeBase =
    input.supplierFeeBaseCents != null && pos(input.supplierFeeBaseCents) > 0
      ? pos(input.supplierFeeBaseCents)
      : wholesale
  // The supplier can never be charged more than what is left of the wholesale after the commission.
  const supplierFeeCents = Math.min(
    wholesale - commissionCents,
    Math.round((feeBase * bps(input.supplierFeeBps)) / 10_000)
  )
  const supplierPayoutCents = wholesale - commissionCents - supplierFeeCents

  const resellerGrossCents = commissionCents + markup
  const resellerFeeCents = Math.round(
    (resellerGrossCents * bps(input.resellerFeeBps ?? RESELLER_PLATFORM_FEE_BPS)) / 10_000
  )
  const resellerPayoutCents = resellerGrossCents - resellerFeeCents

  const listPriceHtCents = wholesale + markup
  const collected = input.collectedHtCents == null ? listPriceHtCents : pos(input.collectedHtCents)

  return {
    wholesaleCents: wholesale,
    commissionCents,
    markupCents: markup,
    supplierFeeCents,
    supplierPayoutCents,
    resellerGrossCents,
    resellerFeeCents,
    resellerPayoutCents,
    platformFeeCents: supplierFeeCents + resellerFeeCents,
    listPriceHtCents,
    platformSubsidyCents: Math.max(0, supplierPayoutCents + resellerPayoutCents - collected),
  }
}
