import "server-only"

import { prisma } from "@/lib/prisma"

const LEGAL_GATE_V2_KEY = "LEGAL_GATE_V2_ENABLED"

let cachedV2: { value: boolean; at: number } | null = null
const CACHE_MS = 60_000

/** Edge/middleware — env only (no Prisma). `LEGAL_GATE_V2_ENABLED=0` forces off. */
export function isLegalGateV2EnabledSync(): boolean {
  if (process.env.LEGAL_GATE_V2_ENABLED === "0") return false
  if (process.env.LEGAL_GATE_V2_ENABLED === "1") return true
  return false
}

export async function isLegalGateV2Enabled(): Promise<boolean> {
  if (process.env.LEGAL_GATE_V2_ENABLED === "0") return false
  if (process.env.LEGAL_GATE_V2_ENABLED === "1") return true

  const now = Date.now()
  if (cachedV2 && now - cachedV2.at < CACHE_MS) {
    return cachedV2.value
  }

  const policy = await prisma.legalPolicy.findUnique({
    where: { key: LEGAL_GATE_V2_KEY },
    select: { enabled: true },
  })

  const value = policy?.enabled ?? false
  cachedV2 = { value, at: now }
  return value
}

export function resetLegalGateV2CacheForTests(): void {
  cachedV2 = null
}

export async function ensureLegalGateV2PolicySeed(): Promise<void> {
  await prisma.legalPolicy.upsert({
    where: { key: LEGAL_GATE_V2_KEY },
    update: {},
    create: { key: LEGAL_GATE_V2_KEY, enabled: false },
  })
}
