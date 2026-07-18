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
  isPro?: boolean | null
  features?: string[] | null
  subscriptionTiers?: string[] | null
}

function plansEnabled(): boolean {
  const v = process.env.RADAR_PLANS_ENABLED?.trim()
  if (v === "false" || v === "0") return false
  return true
}

/**
 * Resolve Radar commercial plan for a user.
 * Dev: RADAR_ENABLED≠true → global (full access while building).
 * Beta user ids / emails → global.
 */
export function getUserRadarPlan(user: RadarPlanUser | null | undefined): RadarPlan {
  if (!plansEnabled() || RADAR_ENABLED !== "true") {
    return RADAR_PLANS.global
  }

  if (!user?.id) return RADAR_PLANS.free

  if (RADAR_BETA_USER_IDS.includes(user.id)) return RADAR_PLANS.global
  if (user.email && RADAR_BETA_USER_IDS.includes(user.email)) return RADAR_PLANS.global

  const tiers = user.subscriptionTiers ?? []
  const features = user.features ?? []

  if (
    tiers.includes("radar_global") ||
    tiers.includes("global") ||
    features.includes("radar_global")
  ) {
    return RADAR_PLANS.global
  }

  if (
    user.isPro ||
    tiers.includes("radar_pro") ||
    tiers.includes("pro") ||
    features.includes("radar_pro") ||
    features.includes("radar") ||
    features.includes("market_intelli")
  ) {
    return RADAR_PLANS.pro
  }

  if (tiers.includes("starter") || features.includes("radar_starter")) {
    return RADAR_PLANS.starter
  }

  return RADAR_PLANS.free
}
