import { clampSupplierCommissionRateBps } from "@/lib/supplier-commission-rate"

/**
 * Performance Intelligence — bonus commission affilié selon le volume fournisseur (30 j).
 * S'applique uniquement quand le produit suit la grille catégorie (commission produit = 0).
 */

export const SUPPLIER_VOLUME_COMMISSION_TIERS = [
  { minGmvCents: 500_000, bonusBps: 50, label: "Starter" },
  { minGmvCents: 2_500_000, bonusBps: 100, label: "Growth" },
  { minGmvCents: 10_000_000, bonusBps: 150, label: "Scale" },
  { minGmvCents: 50_000_000, bonusBps: 200, label: "Elite" },
] as const

export const MAX_SUPPLIER_VOLUME_BONUS_BPS = 200
export const SUPPLIER_VOLUME_LOOKBACK_DAYS = 30

export type SupplierCommissionDynamics = {
  baseBps: number
  volumeBonusBps: number
  effectiveBps: number
  volumeTierLabel: string | null
  trailingGmvCents: number
}

export function volumeTierBonusBps(trailingGmvCents: number): {
  bonusBps: number
  tierLabel: string | null
} {
  if (!Number.isFinite(trailingGmvCents) || trailingGmvCents <= 0) {
    return { bonusBps: 0, tierLabel: null }
  }

  let bonusBps = 0
  let tierLabel: string | null = null
  for (const tier of SUPPLIER_VOLUME_COMMISSION_TIERS) {
    if (trailingGmvCents >= tier.minGmvCents) {
      bonusBps = tier.bonusBps
      tierLabel = tier.label
    }
  }

  return {
    bonusBps: Math.min(MAX_SUPPLIER_VOLUME_BONUS_BPS, bonusBps),
    tierLabel,
  }
}

export function applySupplierCommissionDynamics(input: {
  baseBps: number
  trailingGmvCents?: number | null
}): SupplierCommissionDynamics {
  const baseBps = clampSupplierCommissionRateBps(input.baseBps)
  const trailingGmvCents = Math.max(0, Math.round(input.trailingGmvCents ?? 0))
  const { bonusBps, tierLabel } = volumeTierBonusBps(trailingGmvCents)
  const effectiveBps = clampSupplierCommissionRateBps(baseBps + bonusBps)

  return {
    baseBps,
    volumeBonusBps: bonusBps,
    effectiveBps,
    volumeTierLabel: tierLabel,
    trailingGmvCents,
  }
}

export function isSupplierCommissionDynamicsEnabled(): boolean {
  const raw = process.env.SUPPLIER_COMMISSION_DYNAMICS_ENABLED
  if (raw === "0" || raw === "false") return false
  return true
}
