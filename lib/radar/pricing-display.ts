import type { RadarCheckoutPlanId, RadarPlanId } from "@/lib/radar/plans"
import { RADAR_PLANS } from "@/lib/radar/plans"

/** Affisell Radar is billed in EUR (Stripe: STRIPE_RADAR_*_CURRENCY). */
export const RADAR_BILLING_CURRENCY = "EUR" as const

export function formatRadarPrice(
  amount: number,
  opts?: { short?: boolean; includeSuffix?: boolean }
): string {
  const short = opts?.short === true
  const suffix = opts?.includeSuffix === false ? "" : short ? "/m" : "/mois"
  return `${amount}€${suffix}`
}

export function formatRadarPlanPrice(
  planId: RadarPlanId | RadarCheckoutPlanId,
  opts?: { short?: boolean; includeSuffix?: boolean }
): string {
  const plan = RADAR_PLANS[planId as RadarPlanId]
  if (!plan || plan.price <= 0) return "Gratuit"
  return formatRadarPrice(plan.price, opts)
}

export function radarGlobalUnlockLabel(opts?: { short?: boolean }): string {
  return `Débloque Radar Global à ${formatRadarPlanPrice("global", opts)}`
}

export function radarProUnlockLabel(opts?: { short?: boolean }): string {
  return `Débloque Radar Pro à ${formatRadarPlanPrice("pro", opts)}`
}

export function radarCheckoutCtaLabel(plan: RadarCheckoutPlanId): string {
  const name = plan === "global" ? "Radar Global" : "Radar Pro"
  return `Passer à ${name} — ${formatRadarPlanPrice(plan)} →`
}
