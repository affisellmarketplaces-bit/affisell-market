import { isGrowthPricingTierId, type GrowthPricingTierId } from "@/lib/growth-pricing-tiers"

/**
 * Pure, client-safe helpers for Growth plan checkout (no Prisma, no Stripe server SDK) — the
 * "use client" signup wizards need these to build the checkout request and resolve a
 * post-signup return path, without pulling in lib/stripe-growth.ts (which imports @/lib/prisma).
 */

export type GrowthBillingInterval = "monthly" | "annual"

export function parseGrowthCheckoutPlan(raw: unknown): GrowthPricingTierId | null {
  return typeof raw === "string" && isGrowthPricingTierId(raw) ? raw : null
}

export function parseGrowthBillingInterval(raw: unknown): GrowthBillingInterval | null {
  return raw === "monthly" || raw === "annual" ? raw : null
}

/** Safe return path after a Growth Stripe checkout. */
export function sanitizeGrowthReturnPath(raw: unknown): string {
  if (typeof raw !== "string") return "/pricing"
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    return "/pricing"
  }
  const path = trimmed.split("?")[0]?.split("#")[0] ?? "/pricing"
  if (
    path === "/pricing" ||
    path.startsWith("/pricing/") ||
    path.startsWith("/dashboard/") ||
    path.startsWith("/signup/")
  ) {
    return path
  }
  return "/pricing"
}
