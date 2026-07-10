export type ProductWizardVersion = "v1" | "v2"

export type WizardV2Mode = "express" | "guided" | "pro"

/** Server + client: ENABLE_WIZARD_V2=1|true enables v2 by default. */
export function isWizardV2EnvEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.ENABLE_WIZARD_V2?.trim().toLowerCase()
  return raw === "1" || raw === "true"
}

/**
 * v1: explicit ?wizard=v1 or ?mode=pro
 * v2: explicit ?wizard=v2 or env flag (when not forced v1)
 */
export function resolveProductWizardVersion(args: {
  wizardQuery?: string | null
  modeQuery?: string | null
  envEnabled?: boolean
}): ProductWizardVersion {
  const wizard = args.wizardQuery?.trim().toLowerCase()
  const mode = args.modeQuery?.trim().toLowerCase()

  if (wizard === "v1" || mode === "pro") return "v1"
  if (wizard === "v2") return "v2"

  return args.envEnabled ? "v2" : "v1"
}

export function resolveWizardV2Mode(modeQuery?: string | null): WizardV2Mode {
  const mode = modeQuery?.trim().toLowerCase()
  if (mode === "express" || mode === "guided" || mode === "pro") return mode
  return "guided"
}
