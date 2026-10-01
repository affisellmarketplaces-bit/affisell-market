import { RADAR_BETA_USER_IDS, RADAR_ENABLED } from "@/lib/radar/env"

export type RadarPlanId = "free" | "starter" | "pro" | "global"

/** Paid Radar tiers sold on /pricing */
export type RadarCheckoutPlanId = Extract<RadarPlanId, "pro" | "global">

export type RadarPlan = {
  id: RadarPlanId
  name: string
  maxShops: number
  maxProducts: number
  maxAlerts: number
  hasMap: boolean
  hasSlack: boolean
  price: number
}

export const RADAR_PLANS: Record<RadarPlanId, RadarPlan> = {
  free: {
    id: "free",
    name: "Free",
    maxShops: 0,
    maxProducts: 0,
    maxAlerts: 0,
    hasMap: false,
    hasSlack: false,
    price: 0,
  },
  starter: {
    id: "starter",
    name: "Starter",
    maxShops: 1,
    maxProducts: 100,
    maxAlerts: 0,
    hasMap: false,
    hasSlack: false,
    price: 0,
  },
  pro: {
    id: "pro",
    name: "Radar Pro",
    maxShops: 5,
    maxProducts: 1000,
    maxAlerts: 10,
    hasMap: true,
    hasSlack: false,
    price: 49,
  },
  global: {
    id: "global",
    name: "Radar Global",
    maxShops: 20,
    maxProducts: 10000,
    maxAlerts: 100,
    hasMap: true,
    hasSlack: true,
    price: 99,
  },
}

export type RadarPlanUser = {
  id?: string | null
  email?: string | null
  role?: string | null
  isPro?: boolean | null
  features?: string[] | null
  subscriptionTiers?: string[] | null
  /** Affisell Growth tier (none|lanceur|dominator|empire) — floors the resolved Radar plan. */
  growthPlan?: string | null
}

const RADAR_PLAN_RANK: Record<RadarPlanId, number> = { free: 0, starter: 1, pro: 2, global: 3 }

/**
 * Dominator/Empire Growth subscribers get at least Radar Pro/Global bundled in, without a
 * separate Radar purchase — see AGENTS.md / messages.pricingGrowth ("Radar Grossiste" bullet
 * on Dominator, price-policing bullet on Empire map onto the existing Radar system).
 */
function growthPlanFloor(growthPlan: string | null | undefined): RadarPlanId {
  if (growthPlan === "empire") return "global"
  if (growthPlan === "dominator") return "pro"
  return "free"
}

/** Founder/admin QA: full Radar Global without Stripe. */
export function isRadarAdminBypass(user: RadarPlanUser | null | undefined): boolean {
  return String(user?.role ?? "").toUpperCase() === "ADMIN"
}

export function toRadarPlanUser(
  user: {
    id?: string | null
    email?: string | null
    role?: string | null
    isPro?: boolean | null
    features?: string[] | null
  },
  extras?: { subscriptionTiers?: string[] | null; growthPlan?: string | null }
): RadarPlanUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isPro: user.isPro ?? false,
    features: user.features,
    subscriptionTiers: extras?.subscriptionTiers ?? null,
    growthPlan: extras?.growthPlan ?? null,
  }
}

function plansEnabled(): boolean {
  const v = process.env.RADAR_PLANS_ENABLED?.trim()
  if (v === "false" || v === "0") return false
  return true
}

/**
 * Resolve Radar commercial plan for a user.
 * Dev: RADAR_ENABLED≠true → global (full access while building).
 * ADMIN / beta user ids / emails → global.
 */
export function getUserRadarPlan(user: RadarPlanUser | null | undefined): RadarPlan {
  if (!plansEnabled() || RADAR_ENABLED !== "true") {
    return RADAR_PLANS.global
  }

  if (!user?.id) return RADAR_PLANS.free

  if (isRadarAdminBypass(user)) return RADAR_PLANS.global

  if (RADAR_BETA_USER_IDS.includes(user.id)) return RADAR_PLANS.global
  if (user.email && RADAR_BETA_USER_IDS.includes(user.email)) return RADAR_PLANS.global

  const tiers = user.subscriptionTiers ?? []
  const features = user.features ?? []

  let resolvedId: RadarPlanId = "free"

  if (
    tiers.includes("radar_global") ||
    tiers.includes("global") ||
    features.includes("radar_global")
  ) {
    resolvedId = "global"
  } else if (
    tiers.includes("radar_pro") ||
    tiers.includes("pro") ||
    features.includes("radar_pro") ||
    features.includes("radar") ||
    features.includes("market_intelli")
  ) {
    resolvedId = "pro"
  } else if (tiers.includes("starter") || features.includes("radar_starter")) {
    resolvedId = "starter"
  }

  // A Growth subscription (Dominator/Empire) is a floor, not an override — a user who
  // separately bought a higher Radar tier directly keeps it.
  const floorId = growthPlanFloor(user.growthPlan)
  const finalId = RADAR_PLAN_RANK[floorId] > RADAR_PLAN_RANK[resolvedId] ? floorId : resolvedId

  return RADAR_PLANS[finalId]
}
