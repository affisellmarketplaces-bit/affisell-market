import type { DemoPersonaKey } from "@/lib/demo/demo-shared"
import {
  DEMO_LAB_ACCOUNT_META,
  type DemoLabAccountMeta,
} from "@/lib/demo/demo-accounts-shared"

export type DemoLabResolvedAccount = DemoLabAccountMeta & {
  password: string
}

const PASSWORD_ENV_BY_PERSONA: Record<DemoPersonaKey, string> = {
  supplier: "DEMO_SUPPLIER_PASSWORD",
  affiliate: "DEMO_AFFILIATE_PASSWORD",
  buyer: "DEMO_BUYER_PASSWORD",
}

function envTrim(key: string): string | undefined {
  const v = process.env[key]?.trim()
  return v?.length ? v : undefined
}

/** Explicit opt-out (prod safety). */
export function isDemoLabExplicitlyDisabled(): boolean {
  const v = envTrim("DEMO_LAB_ENABLED")?.toLowerCase()
  return v === "0" || v === "false"
}

/**
 * Demo Lab on by default for local dev + Vercel Preview (PR / branch URLs).
 * Production requires DEMO_LAB_ENABLED=1 unless explicitly disabled.
 */
export function isDemoLabEnabled(): boolean {
  if (isDemoLabExplicitlyDisabled()) return false

  const flag = envTrim("DEMO_LAB_ENABLED")?.toLowerCase()
  if (flag === "1" || flag === "true") return true

  const vercelEnv = envTrim("VERCEL_ENV")
  if (vercelEnv === "preview") return true

  if (process.env.NODE_ENV !== "production") return true

  return false
}

export type DemoLabPublicState = {
  enabled: boolean
  configured: boolean
  /** Why the portal is hidden or degraded (for support / Metabase). */
  mode: "ready" | "disabled" | "not_configured"
}

export function getDemoLabPublicState(): DemoLabPublicState {
  const enabled = isDemoLabEnabled()
  if (!enabled) {
    return { enabled: false, configured: false, mode: "disabled" }
  }
  const configured = resolveDemoPassword("supplier") !== null
  if (!configured) {
    return { enabled: true, configured: false, mode: "not_configured" }
  }
  return { enabled: true, configured: true, mode: "ready" }
}

export function resolveDemoPassword(persona: DemoPersonaKey): string | null {
  const shared = envTrim("DEMO_LAB_PASSWORD")
  if (shared) return shared
  return envTrim(PASSWORD_ENV_BY_PERSONA[persona]) ?? null
}

export function resolveDemoLabAccount(persona: DemoPersonaKey): DemoLabResolvedAccount | null {
  if (!isDemoLabEnabled()) return null
  const password = resolveDemoPassword(persona)
  if (!password) return null
  const meta = DEMO_LAB_ACCOUNT_META[persona]
  return { ...meta, password }
}
