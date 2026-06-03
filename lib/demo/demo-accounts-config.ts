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

export function isDemoLabEnabled(): boolean {
  const v = envTrim("DEMO_LAB_ENABLED")?.toLowerCase()
  return v === "1" || v === "true"
}

export function getDemoLabPublicState(): { enabled: boolean; configured: boolean } {
  const enabled = isDemoLabEnabled()
  const configured = enabled && resolveDemoPassword("supplier") !== null
  return { enabled, configured }
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
