import type { EnvBag } from "@/lib/env-bag"

export type ProductWizardVersion = "v1" | "v2"

/** InstantScan (`guided`) retired — v2 ships Express + Pro only. */
export type WizardV2Mode = "express" | "pro"

/** Server + client: ENABLE_WIZARD_V2=1|true — Express wizard available (dev / rollout). */
export function isWizardV2EnvEnabled(env: EnvBag = process.env): boolean {
  const raw = env.ENABLE_WIZARD_V2?.trim().toLowerCase()
  return raw === "1" || raw === "true"
}

/**
 * v2 hub: ?wizard=v2 (any mode), ?mode=express, or ENABLE_WIZARD_V2 locally.
 * Legacy v1 composer only: ?wizard=v1 without v2 hub.
 */
export function resolveProductWizardVersion(args: {
  wizardQuery?: string | null
  modeQuery?: string | null
  envEnabled?: boolean
}): ProductWizardVersion {
  const wizard = args.wizardQuery?.trim().toLowerCase()
  const mode = args.modeQuery?.trim().toLowerCase()

  if (wizard === "v1") return "v1"
  if (wizard === "v2" || mode === "express") return "v2"
  if (args.envEnabled) return "v2"

  return "v1"
}

/**
 * Pro is the default v2 mode (redirects to v1 composer).
 * Legacy `guided` / InstantScan query params still map to Express in the v2 shell.
 */
export function resolveWizardV2Mode(modeQuery?: string | null): WizardV2Mode {
  const mode = modeQuery?.trim().toLowerCase()
  if (mode === "express") return "express"
  return "pro"
}
