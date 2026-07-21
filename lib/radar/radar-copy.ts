/**
 * Radar UI copy — split by persona.
 * AFFILIATE = no-stock reseller · SUPPLIER = stock / grossiste opportunity.
 */

import {
  computeSmartPricing,
  formatEnrichEuro,
} from "@/lib/import/smart-import-enricher"

/** @deprecated Prefer getRadarCopyForAffiliate().tooltip — kept for tests / tooltips. */
export const RADAR_NO_STOCK_TOOLTIP =
  "Comment ça marche sans stock? Tu listes à 36,75€. Quand tu vends, Affisell achète à 11,55€ chez le fournisseur EU et livre ton client. Tu touches 25,20€. 0 stock, 0 avance."

/** Example economics shown when winner has no cost/sale (legacy no-stock snapshot). */
export const RADAR_NO_STOCK_ECONOMICS = {
  listPrice: "36,75",
  costAfterSale: "11,55",
  profit: "25,20",
} as const

export type RadarCopyWinnerInput = {
  id?: string
  title?: string
  score?: number | null
  searches?: number | null
  salePrice?: number | null
  costPrice?: number | null
  supplierPrice?: number | null
  price?: number | null
  supplierCount?: number | null
}

export type RadarPersonaCopy = {
  arbitrageLabel: string
  opportunityLabel: string
  supplierLabel: string
  ctaLabel: string
  tooltip: string
  ctaHref: (country: string) => string
}

function resolveScore(winner: RadarCopyWinnerInput): number {
  if (winner.score != null && Number.isFinite(winner.score)) {
    return Math.round(winner.score)
  }
  return 92
}

function resolveSearches(winner: RadarCopyWinnerInput): number {
  if (winner.searches != null && Number.isFinite(winner.searches)) {
    return Math.round(winner.searches)
  }
  return 12_000
}

function resolveEconomics(winner: RadarCopyWinnerInput): {
  salePrice: string
  costPrice: string
  margin: string
} {
  if (winner.salePrice != null && winner.costPrice != null) {
    const sale = winner.salePrice
    const cost = winner.costPrice
    return {
      salePrice: formatEnrichEuro(sale),
      costPrice: formatEnrichEuro(cost),
      margin: formatEnrichEuro(sale - cost),
    }
  }
  const pricing = computeSmartPricing({
    title: winner.title ?? "",
    supplierPrice: winner.supplierPrice ?? winner.costPrice ?? null,
    price: winner.price ?? null,
  })
  // Prefer iconic no-stock snapshot when using default 4.2 cost (affiliate education).
  if (pricing.costPrice === 4.2 && winner.salePrice == null) {
    return {
      salePrice: RADAR_NO_STOCK_ECONOMICS.listPrice,
      costPrice: RADAR_NO_STOCK_ECONOMICS.costAfterSale,
      margin: RADAR_NO_STOCK_ECONOMICS.profit,
    }
  }
  return {
    salePrice: formatEnrichEuro(pricing.salePrice),
    costPrice: formatEnrichEuro(pricing.costPrice),
    margin: formatEnrichEuro(pricing.margin),
  }
}

function resolveSupplierCount(winner: RadarCopyWinnerInput): number {
  if (winner.supplierCount != null && winner.supplierCount >= 0) {
    return winner.supplierCount
  }
  return 3
}

export function getRadarCopyForAffiliate(
  winner: RadarCopyWinnerInput,
  country: string
): RadarPersonaCopy {
  const code = country.trim().toUpperCase() || "FR"
  const score = resolveScore(winner)
  const { salePrice, costPrice, margin } = resolveEconomics(winner)
  const count = resolveSupplierCount(winner)

  return {
    arbitrageLabel: `🔥 ${score}/100 - Marché Vierge ${code} - Tu vends à ${salePrice}€ = +${margin}€ sans stock`,
    opportunityLabel:
      count > 0
        ? `💜 ${count} signal${count > 1 ? "s" : ""} FR — liste sans stock →`
        : `💜 Marché Vierge ${code} - 0 concurrent - Lancement 1er sans stock →`,
    supplierLabel:
      count >= 3
        ? `✅ ${count} fournisseurs EU - 4j - Sans stock`
        : count > 0
          ? `✅ ${count} fournisseur${count > 1 ? "s" : ""} EU - Sans stock`
          : `💜 Marché Vierge ${code} - 0 concurrent - Lancement 1er sans stock →`,
    ctaLabel: `Lister sans stock →`,
    tooltip: `Tu listes à ${salePrice}€. Quand tu vends, Affisell achète à ${costPrice}€ et livre. Tu touches ${margin}€. 0 stock.`,
    ctaHref: () => "/dashboard/affiliate/catalog?filter=draft",
  }
}

export function getRadarCopyForSupplier(
  winner: RadarCopyWinnerInput,
  country: string
): RadarPersonaCopy {
  const code = country.trim().toUpperCase() || "FR"
  const score = resolveScore(winner)
  const searches = resolveSearches(winner)
  const searchesLabel = searches.toLocaleString("fr-FR")
  const count = resolveSupplierCount(winner)
  const winnerId = winner.id?.trim() ?? ""

  return {
    arbitrageLabel: `🔥 ${score}/100 - ${searchesLabel} recherches/mois - Marge x3 pour tes resellers`,
    opportunityLabel: `📦 Opportunité Grossiste ${code} - 0 fournisseur local - Devenir le seul →`,
    supplierLabel:
      count > 0
        ? `⚠️ ${count} fournisseurs EU - 4j - Rupture imminente`
        : `📦 Opportunité Grossiste ${code} - 0 fournisseur local - Devenir le seul →`,
    ctaLabel: `Devenir fournisseur →`,
    tooltip: `${searchesLabel} recherches/mois en ${code}. 0 fournisseur local. Positionne ton stock et 150 resellers Affisell vendront pour toi.`,
    ctaHref: (c) => {
      const qs = new URLSearchParams({
        from: "radar",
        mode: "supplier",
        country: c.trim().toUpperCase() || code,
      })
      if (winnerId) qs.set("winnerId", winnerId)
      return `/dashboard/supplier/products/new?${qs.toString()}`
    },
  }
}

export function getRadarCopyForRole(
  role: string | null | undefined,
  winner: RadarCopyWinnerInput,
  country: string
): RadarPersonaCopy {
  if (role === "SUPPLIER") return getRadarCopyForSupplier(winner, country)
  return getRadarCopyForAffiliate(winner, country)
}

export function isRadarSupplierRole(role: string | null | undefined): boolean {
  return role === "SUPPLIER"
}

/** Bulk sticky bar label */
export function radarBulkBarLabel(args: {
  role: string | null | undefined
  count: number
  marginEuro?: number
}): string {
  const n = args.count
  if (isRadarSupplierRole(args.role)) {
    return `⚡ Proposer ces ${n} produits comme fournisseur exclusif FR`
  }
  const margin =
    args.marginEuro != null ? formatEnrichEuro(args.marginEuro) : "215,00"
  return `⚡ Lister les ${n} sans stock (Marge +${margin}€)`
}

/* ── Legacy helpers (affiliate no-stock) — keep tests / older imports green ── */

export function radarArbitrageGoldLabel(score: number): string {
  return getRadarCopyForAffiliate({ score }, "FR").arbitrageLabel
}

export function radarArbitrageGoldHint(): string {
  const e = RADAR_NO_STOCK_ECONOMICS
  return `Tu vends à ${e.listPrice}€, tu payes ${e.costAfterSale}€ après vente = +${e.profit}€ sans stock`
}

export function radarArbitrageSilverLabel(score: number): string {
  return `🔥 ${score}/100 - Opportunité FR`
}

export function radarArbitrageSilverHint(): string {
  return `Marge x2 estimée — liste sans stock, Affisell livre`
}

export function radarArbitrageBronzeLabel(score: number): string {
  return `${score}/100 - Signal cross-border`
}

export function radarArbitrageBronzeHint(): string {
  return `À surveiller — lancement possible sans stock`
}

export function radarSupplierMatchEmptyCopy(country = "FR"): string {
  return getRadarCopyForAffiliate({ supplierCount: 0 }, country).opportunityLabel
}

export function radarSupplierMatchPositiveCopy(count: number): string {
  return getRadarCopyForAffiliate({ supplierCount: count }, "FR").supplierLabel
}

export function radarEuSuppliersFastLabel(): string {
  return getRadarCopyForAffiliate({ supplierCount: 3 }, "FR").supplierLabel
}

export function radarActionCtaLabel(role: string | null | undefined): string {
  return getRadarCopyForRole(role, {}, "FR").ctaLabel
}

export function radarActionCtaHref(
  role: string | null | undefined,
  country: string,
  winnerId?: string
): string {
  return getRadarCopyForRole(role, { id: winnerId }, country).ctaHref(country)
}
