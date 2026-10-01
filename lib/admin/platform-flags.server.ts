import "server-only"

import { prisma } from "@/lib/prisma"

export const PLATFORM_FLAG_KEYS = {
  growthCatalogCapPaused: "growth_catalog_cap_paused",
  merchantKycGatePaused: "merchant_kyc_gate_paused",
} as const

export type PlatformFlagKey = (typeof PLATFORM_FLAG_KEYS)[keyof typeof PLATFORM_FLAG_KEYS]

export const PLATFORM_FLAG_LABELS: Record<PlatformFlagKey, { title: string; description: string }> = {
  [PLATFORM_FLAG_KEYS.growthCatalogCapPaused]: {
    title: "Plafond catalogue (200 produits)",
    description:
      "En pause : plus aucun fournisseur n'est bloqué par la limite de produits en ligne, quel que soit son palier Growth Plan.",
  },
  [PLATFORM_FLAG_KEYS.merchantKycGatePaused]: {
    title: "Vérification KYC fournisseur",
    description:
      "En pause : la publication de produits n'exige plus de profil fournisseur vérifié (création manuelle, import CSV, import en masse).",
  },
}

/** DB-backed override, falls back to `false` (not paused) when no row exists yet. */
export async function isPlatformFlagEnabled(key: PlatformFlagKey): Promise<boolean> {
  const row = await prisma.platformFlag.findUnique({ where: { key }, select: { enabled: true } })
  return row?.enabled ?? false
}

export async function setPlatformFlag(
  key: PlatformFlagKey,
  enabled: boolean,
  updatedBy?: string
): Promise<void> {
  await prisma.platformFlag.upsert({
    where: { key },
    create: { key, enabled, updatedBy },
    update: { enabled, updatedBy },
  })
}

export async function listPlatformFlags(): Promise<
  Array<{ key: PlatformFlagKey; enabled: boolean; updatedAt: Date | null; updatedBy: string | null }>
> {
  const keys = Object.values(PLATFORM_FLAG_KEYS)
  const rows = await prisma.platformFlag.findMany({ where: { key: { in: keys } } })
  const byKey = new Map(rows.map((r) => [r.key, r]))
  return keys.map((key) => {
    const row = byKey.get(key)
    return {
      key,
      enabled: row?.enabled ?? false,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    }
  })
}
