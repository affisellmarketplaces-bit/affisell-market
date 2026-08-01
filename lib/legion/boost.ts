/**
 * Affisell LÉGION BOOST — 2h commission battle helpers (client-safe).
 */

export const BOOST_DURATION_MS = 2 * 60 * 60 * 1000
export const BOOST_DURATION_HOURS = 2
export const BOOST_MARGIN_MIN = 0.35
export const BOOST_MARGIN_MAX = 0.5
export const BOOST_MARGIN_DEFAULT = 0.4

export type BoostUrgency = {
  minutesLeft: number
  /** 0–1 remaining fraction of the 2h window */
  progress: number
  isCritical: boolean
}

export function clampBoostMarginRate(rate: number): number {
  const n = Number(rate)
  if (!Number.isFinite(n)) return BOOST_MARGIN_DEFAULT
  return Math.min(BOOST_MARGIN_MAX, Math.max(BOOST_MARGIN_MIN, n))
}

export function calculateBoostUrgency(
  endsAt: Date | string,
  now: Date = new Date()
): BoostUrgency {
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt)
  const msLeft = Math.max(0, end.getTime() - now.getTime())
  const minutesLeft = Math.ceil(msLeft / 60_000)
  const progress = Math.min(1, Math.max(0, msLeft / BOOST_DURATION_MS))
  return {
    minutesLeft,
    progress,
    isCritical: minutesLeft > 0 && minutesLeft <= 15,
  }
}

export function formatBoostMessage(args: {
  productTitle: string
  boostMarginRate: number
  minutesLeft: number
}): string {
  const pct = Math.round(args.boostMarginRate * 100)
  const title = args.productTitle.trim() || "Produit"
  if (args.minutesLeft <= 0) {
    return `BOOST terminé — ${title}`
  }
  return `BATTLE ROYALE — ${title} à ${pct}% · ${args.minutesLeft} min restantes`
}

export function boostEndsAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + BOOST_DURATION_MS)
}

/** Convert Affisell Product.commissionRate (int %) → decimal 0–1. */
export function commissionRateToMarginDecimal(commissionRate: number | null | undefined): number {
  const n = Number(commissionRate)
  if (!Number.isFinite(n) || n <= 0) return 0.3
  if (n > 1) return Math.min(0.99, n / 100)
  return n
}
