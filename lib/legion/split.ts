/**
 * Affisell LÉGION — split constants + pure payout math (EUR decimals).
 * Additive to existing Connect / Lightning — does not replace them.
 */

export const LEGION_OVERRIDE_RATE = 0.02
export const PLATFORM_FEE = 0.1
export const RESERVE_RATE = 0.2
/** Hours after reservation before instant payout eligibility window. */
export const PAYOUT_DELAY = 24

export type LegionSplitResult = {
  product_price: number
  seller_margin_rate: number
  base_seller_earnings: number
  legion_override: number
  seller_earnings: number
  remaining_after_seller: number
  platform_fee: number
  supplier_gross: number
  reserve: number
  supplier: number
  sponsor_id: string | null
  override_rate: number
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

type LegionReferralRow = {
  sponsorId: string
  overrideRate: { toNumber(): number } | number | string
  status: string
}

type LegionDb = {
  legionReferral: {
    findFirst: (args: {
      where: { referredId: string; status: string }
      select: { sponsorId: true; overrideRate: true; status: true }
    }) => Promise<LegionReferralRow | null>
  }
}

/**
 * Calculate three-way split with optional LÉGION 2% override paid from filleul margin.
 * `supabase` arg is the Prisma client (Affisell) — named for brief compatibility.
 */
export async function calculateLegionSplit(args: {
  supabase: LegionDb
  product_price: number
  seller_margin_rate: number
  store_profile_id: string
}): Promise<LegionSplitResult> {
  const price = Math.max(0, Number(args.product_price) || 0)
  const margin = Math.min(1, Math.max(0, Number(args.seller_margin_rate) || 0))

  const referral = await args.supabase.legionReferral.findFirst({
    where: { referredId: args.store_profile_id, status: "active" },
    select: { sponsorId: true, overrideRate: true, status: true },
  })

  const overrideRate = referral
    ? typeof referral.overrideRate === "object" && referral.overrideRate && "toNumber" in referral.overrideRate
      ? referral.overrideRate.toNumber()
      : Number(referral.overrideRate)
    : 0

  const baseSellerEarnings = round2(price * margin)
  const legionOverride = referral ? round2(price * overrideRate) : 0
  /** Filleul pays override from their margin — never from supplier. */
  const sellerEarnings = round2(Math.max(0, baseSellerEarnings - legionOverride))
  const remainingAfterSeller = round2(price - baseSellerEarnings)
  const platformFee = round2(price * PLATFORM_FEE)
  const supplierGross = round2(Math.max(0, remainingAfterSeller - platformFee))
  const reserve = round2(supplierGross * RESERVE_RATE)
  const supplier = round2(Math.max(0, supplierGross - reserve))

  return {
    product_price: round2(price),
    seller_margin_rate: margin,
    base_seller_earnings: baseSellerEarnings,
    legion_override: legionOverride,
    seller_earnings: sellerEarnings,
    remaining_after_seller: remainingAfterSeller,
    platform_fee: platformFee,
    supplier_gross: supplierGross,
    reserve,
    supplier,
    sponsor_id: referral?.sponsorId ?? null,
    override_rate: overrideRate || LEGION_OVERRIDE_RATE,
  }
}

export function getPayoutDueAt(from: Date = new Date()): string {
  const due = new Date(from.getTime() + PAYOUT_DELAY * 60 * 60 * 1000)
  return due.toISOString()
}

/** Instant payout when available balance covers earnings (EUR). */
export function canInstantPayout(balance: number, earnings: number): boolean {
  const b = Number(balance) || 0
  const e = Number(earnings) || 0
  return e > 0 && b >= e
}
