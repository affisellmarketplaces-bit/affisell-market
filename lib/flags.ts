/**
 * Affisell feature flags — opt-in via NEXT_PUBLIC_FF_* (staging first, then prod).
 * Client-safe: only reads public env vars.
 */

export const flags = {
  /** Affisell Radar v2 UI experiments */
  enableNewRadar: process.env.NEXT_PUBLIC_FF_NEW_RADAR === "1",
  /** Luxe storefront / premium merchandising experiments */
  enableLuxe: process.env.NEXT_PUBLIC_FF_LUXE === "1",
  /** Admin Humanoid Shield live dashboard (/dashboard/admin/security) */
  enableHumanoidShieldDashboard:
    process.env.NEXT_PUBLIC_FF_HUMANOID_SHIELD_DASHBOARD !== "0",
  /** Guided product wizard v2 (also ENABLE_WIZARD_V2 server-side) */
  enableWizardV2:
    process.env.NEXT_PUBLIC_FF_WIZARD_V2 === "1" ||
    process.env.NEXT_PUBLIC_ENABLE_WIZARD_V2 === "1",
  /** InstantScan vision pipeline in wizard */
  enableInstantScan: process.env.NEXT_PUBLIC_FF_INSTANTSCAN === "1",
} as const

export type AffisellFlagName = keyof typeof flags

/** Returns true when a NEXT_PUBLIC_FF_* flag is enabled. */
export function isFlagEnabled(flagName: AffisellFlagName): boolean {
  return flags[flagName]
}

/** Staging-only helper — true on Vercel Preview or when FF explicitly set. */
export function isFlagEnabledInStaging(flagName: AffisellFlagName): boolean {
  const vercel = process.env.VERCEL_ENV?.trim().toLowerCase()
  if (vercel === "preview") return isFlagEnabled(flagName)
  if (vercel === "production") return isFlagEnabled(flagName)
  if (process.env.NODE_ENV === "development") return isFlagEnabled(flagName)
  return isFlagEnabled(flagName)
}
