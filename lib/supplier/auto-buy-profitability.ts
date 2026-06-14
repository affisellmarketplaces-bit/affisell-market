/**
 * Étude de rentabilité auto-buy par SKU — fonctions pures (client-safe, pas de Prisma).
 *
 * Modèle économique d'une vente auto-buy :
 *   profit = prix catalogue − COGS (AE prix+port) − fee Affisell (bps sur COGS)
 *            − commission affilié (bps sur prix catalogue)
 *
 * Le score santé mélange la marge théorique et la marge réalisée (commandes payées)
 * pour détecter les SKU dont la rentabilité réelle décroche de la théorie.
 */

import {
  resolveCatalogPriceSuggestion,
  type CatalogPeerBenchmark,
  type CatalogPriceSuggestionSource,
} from "@/lib/supplier/catalog-peer-pricing"
import {
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
} from "@/lib/marketplace-phase1-fees"

/** Objectif de marge nette par défaut pour le prix conseillé (30 %). */
export const PROFIT_TARGET_MARGIN_BPS = 3000

export type SkuHealthBand = "excellent" | "good" | "warning" | "loss" | "unknown"

export type SkuEconomicsInput = {
  /** Prix catalogue fournisseur HT (basePriceCents). */
  sellingPriceCents: number
  /** COGS auto-buy : AE prix + port (null si lien incomplet). */
  cogsCents: number | null
  /** Commission affilié en bps (commissionRate % × 100). */
  affiliateCommissionBps: number
  /** Fee Affisell auto-buy en bps (défaut plateforme : 1700). */
  supplierFeeBps?: number
  /** Ventes réalisées (fenêtre 30 j) — revenue = somme basePriceCents catalogue, pas revente affilié. */
  realized?: {
    orders: number
    revenueCents: number
    marginCents: number
  } | null
  /** Médiane HT des autres fournisseurs Affisell (même catégorie). */
  catalogPeerBenchmark?: CatalogPeerBenchmark | null
}

export type SkuEconomics = {
  grossMarginCents: number | null
  grossMarginPct: number | null
  netMarginCents: number | null
  netMarginPct: number | null
  /** Prix plancher où la marge nette = 0 (COGS + fees). */
  breakEvenPriceCents: number | null
  /** Cible marge 30 % — plancher interne si pas assez de pairs catalogue. */
  marginTargetPriceCents: number | null
  /** Prix catalogue conseillé (pairs Affisell prioritaire). */
  suggestedPriceCents: number | null
  suggestedPriceSource: CatalogPriceSuggestionSource | null
  catalogPeerMedianCents: number | null
  catalogPeerCount: number
  healthScore: number | null
  healthBand: SkuHealthBand
  realizedNetMarginPct: number | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function bandFromNetPct(netPct: number): SkuHealthBand {
  if (netPct < 0) return "loss"
  if (netPct < 8) return "warning"
  if (netPct < 20) return "good"
  return "excellent"
}

/** Score 0–100 depuis une marge nette en % (25 % et plus = 100). */
function scoreFromNetPct(netPct: number): number {
  return clamp(Math.round(netPct * 4), 0, 100)
}


export function computeSkuEconomics(input: SkuEconomicsInput): SkuEconomics {
  const selling = Math.max(0, Math.round(input.sellingPriceCents))
  const feeBps = Math.max(0, Math.round(input.supplierFeeBps ?? DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY))
  const commissionBps = clamp(Math.round(input.affiliateCommissionBps), 0, 9_500)
  const peer = input.catalogPeerBenchmark ?? null

  const realized = input.realized ?? null
  const realizedNetMarginPct =
    realized && realized.orders > 0 && realized.revenueCents > 0
      ? (realized.marginCents / realized.revenueCents) * 100
      : null

  if (input.cogsCents == null || input.cogsCents <= 0 || selling <= 0) {
    const resolved = resolveCatalogPriceSuggestion({
      breakEvenPriceCents: null,
      marginTargetPriceCents: null,
      peer,
    })
    return {
      grossMarginCents: null,
      grossMarginPct: null,
      netMarginCents: null,
      netMarginPct: null,
      breakEvenPriceCents: null,
      marginTargetPriceCents: null,
      suggestedPriceCents: resolved.suggestedPriceCents,
      suggestedPriceSource: resolved.suggestedPriceSource,
      catalogPeerMedianCents: resolved.catalogPeerMedianCents,
      catalogPeerCount: resolved.catalogPeerCount,
      healthScore: realizedNetMarginPct != null ? scoreFromNetPct(realizedNetMarginPct) : null,
      healthBand: realizedNetMarginPct != null ? bandFromNetPct(realizedNetMarginPct) : "unknown",
      realizedNetMarginPct,
    }
  }

  const cogs = Math.round(input.cogsCents)
  const feeCents = Math.round((cogs * feeBps) / 10_000)
  const commissionCents = Math.round((selling * commissionBps) / 10_000)

  const grossMarginCents = selling - cogs
  const netMarginCents = selling - cogs - feeCents - commissionCents
  const grossMarginPct = (grossMarginCents / selling) * 100
  const netMarginPct = (netMarginCents / selling) * 100

  // selling × (1 − commission) = cogs × (1 + fee)  →  marge nette nulle
  const commissionFrac = commissionBps / 10_000
  const fixedCosts = cogs + feeCents
  const breakEvenPriceCents =
    commissionFrac < 1 ? Math.ceil(fixedCosts / (1 - commissionFrac)) : null

  // selling × (1 − commission − cible) = cogs + fee
  const targetFrac = PROFIT_TARGET_MARGIN_BPS / 10_000
  const denom = 1 - commissionFrac - targetFrac
  const marginTargetPriceCents = denom > 0 ? Math.ceil(fixedCosts / denom) : null
  const resolved = resolveCatalogPriceSuggestion({
    breakEvenPriceCents,
    marginTargetPriceCents,
    peer,
  })

  const theoreticalScore = scoreFromNetPct(netMarginPct)
  // ≥3 ventes réelles : 50/50 théorie / réalité (drift de rentabilité visible)
  const healthScore =
    realizedNetMarginPct != null && (realized?.orders ?? 0) >= 3
      ? Math.round((theoreticalScore + scoreFromNetPct(realizedNetMarginPct)) / 2)
      : theoreticalScore

  return {
    grossMarginCents,
    grossMarginPct,
    netMarginCents,
    netMarginPct,
    breakEvenPriceCents,
    marginTargetPriceCents,
    suggestedPriceCents: resolved.suggestedPriceCents,
    suggestedPriceSource: resolved.suggestedPriceSource,
    catalogPeerMedianCents: resolved.catalogPeerMedianCents,
    catalogPeerCount: resolved.catalogPeerCount,
    healthScore,
    healthBand: bandFromNetPct(netMarginPct),
    realizedNetMarginPct,
  }
}

export type PilotPortfolioSummary = {
  totalSkus: number
  autoBuyOnCount: number
  avgHealthScore: number | null
  lossCount: number
  realizedOrders30d: number
  realizedRevenueCents30d: number
  realizedMarginCents30d: number
}

export function summarizePilotPortfolio(
  rows: ReadonlyArray<{
    autoBuyEnabled: boolean
    economics: SkuEconomics
    realized?: { orders: number; revenueCents: number; marginCents: number } | null
  }>
): PilotPortfolioSummary {
  const scores = rows
    .map((r) => r.economics.healthScore)
    .filter((s): s is number => s != null)
  return {
    totalSkus: rows.length,
    autoBuyOnCount: rows.filter((r) => r.autoBuyEnabled).length,
    avgHealthScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    lossCount: rows.filter((r) => r.economics.healthBand === "loss").length,
    realizedOrders30d: rows.reduce((a, r) => a + (r.realized?.orders ?? 0), 0),
    realizedRevenueCents30d: rows.reduce((a, r) => a + (r.realized?.revenueCents ?? 0), 0),
    realizedMarginCents30d: rows.reduce((a, r) => a + (r.realized?.marginCents ?? 0), 0),
  }
}
