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
 * Pro (v1 composer) is the default landing.
 * Express (v2): explicit ?wizard=v2 or ?mode=express only.
 */
export function resolveProductWizardVersion(args: {
  wizardQuery?: string | null
  modeQuery?: string | null
  /** @deprecated Pro-first default — kept for call-site compat, ignored. */
  envEnabled?: boolean
}): ProductWizardVersion {
  const wizard = args.wizardQuery?.trim().toLowerCase()
  const mode = args.modeQuery?.trim().toLowerCase()

  if (wizard === "v1" || mode === "pro") return "v1"
  if (wizard === "v2" || mode === "express") return "v2"

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
