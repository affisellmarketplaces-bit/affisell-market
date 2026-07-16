import type { RadarPlan, RadarPlanId, RadarPlanUser } from "@/lib/radar/plans"
import { getUserRadarPlan } from "@/lib/radar/plans"

export type RadarAccessFeature = "map" | "slack" | "alerts" | "dashboard" | "scan"

export type RadarAccessResult = {
  allowed: boolean
  plan: RadarPlan
  reason?: string
  upgradePath: string
}

export function checkRadarAccess(
  user: RadarPlanUser | null | undefined,
  required: RadarAccessFeature
): RadarAccessResult {
  const plan = getUserRadarPlan(user)
  const upgradePath = "/pricing?feature=radar"

  if (required === "dashboard" || required === "scan") {
    if (plan.id === "free") {
      return {
        allowed: false,
        plan,
        reason: "Upgrade to Radar Pro for live winners",
        upgradePath,
      }
    }
    return { allowed: true, plan, upgradePath }
  }

  if (required === "map") {
    if (!plan.hasMap) {
      return {
        allowed: false,
        plan,
        reason: "Upgrade to Pro for Map",
        upgradePath,
      }
    }
    return { allowed: true, plan, upgradePath }
  }

  if (required === "slack") {
    if (!plan.hasSlack) {
      return {
        allowed: false,
        plan,
        reason: "Slack alerts available on Radar Global $99/m",
        upgradePath,
      }
    }
    return { allowed: true, plan, upgradePath }
  }

  if (required === "alerts") {
    if (plan.maxAlerts <= 0) {
      return {
        allowed: false,
        plan,
        reason: "Upgrade to Pro for Radar alerts",
        upgradePath,
      }
    }
    return { allowed: true, plan, upgradePath }
  }

  return { allowed: false, plan, reason: "Upgrade required", upgradePath }
}

export function planLimitReached(
  plan: RadarPlan,
  kind: "products" | "shops" | "alerts",
  count: number
): boolean {
  if (kind === "products") return count > plan.maxProducts
  if (kind === "shops") return count > plan.maxShops
  return count > plan.maxAlerts
}

export function isPaidRadarPlan(id: RadarPlanId): boolean {
  return id === "pro" || id === "global"
}
