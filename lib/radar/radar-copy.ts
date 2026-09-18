/**
 * Radar UI copy — split by persona.
 * AFFILIATE = no-stock reseller · SUPPLIER = stock / grossiste opportunity.
 */

import {
  computeSmartPricing,
  formatEnrichEuro,
} from "@/lib/import/smart-import-enricher"
import { formatRadarSupplierDeliveryLine } from "@/lib/logistics/delivery-sla"
import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"

function tr(locale: AppLocale, key: string, vars: Record<string, string | number> = {}): string {
  let out = tMessage(locale, `radarTerminal.${key}`)
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

const NUMBER_LOCALE: Record<AppLocale, string> = {
  fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES", it: "it-IT", nl: "nl-NL", pl: "pl-PL", zh: "zh-CN",
}

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
  country: string,
  locale: AppLocale = "fr"
): RadarPersonaCopy {
  const code = country.trim().toUpperCase() || "FR"
  const score = resolveScore(winner)
  const { salePrice, costPrice, margin } = resolveEconomics(winner)
  const count = resolveSupplierCount(winner)
  const emptyLabel = tr(locale, "oppEmpty", { code })
  const line = (days: number) =>
    formatRadarSupplierDeliveryLine({ count, marketCountry: code, origin: "EU", days, locale })

  return {
    arbitrageLabel: tr(locale, "affArbitrage", { score, code, sale: salePrice, margin }),
    opportunityLabel:
      count > 0
        ? tr(locale, count > 1 ? "oppSignalMany" : "oppSignalOne", { count, code })
        : emptyLabel,
    supplierLabel: count >= 3 ? line(3) : count > 0 ? line(4) : emptyLabel,
    ctaLabel: tr(locale, "affCta"),
    tooltip: tr(locale, "affTooltip", { sale: salePrice, cost: costPrice, margin }),
    ctaHref: () => "/dashboard/affiliate/catalog?filter=draft",
  }
}

export function getRadarCopyForSupplier(
  winner: RadarCopyWinnerInput,
  country: string,
  locale: AppLocale = "fr"
): RadarPersonaCopy {
  const code = country.trim().toUpperCase() || "FR"
  const score = resolveScore(winner)
  const searches = resolveSearches(winner)
  const searchesLabel = searches.toLocaleString(NUMBER_LOCALE[locale] ?? "fr-FR")
  const count = resolveSupplierCount(winner)
  const winnerId = winner.id?.trim() ?? ""
  const opportunity = tr(locale, "supOpportunity", { code })

  return {
    arbitrageLabel: tr(locale, "supArbitrage", { score, searches: searchesLabel }),
    opportunityLabel: opportunity,
    supplierLabel:
      count > 0
        ? tr(locale, "supImminent", {
            line: formatRadarSupplierDeliveryLine({
              count,
              marketCountry: code,
              origin: "EU",
              days: 4,
              locale,
            }),
          })
        : opportunity,
    ctaLabel: tr(locale, "supCta"),
    tooltip: tr(locale, "supTooltip", { searches: searchesLabel, code }),
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
  country: string,
  locale: AppLocale = "fr"
): RadarPersonaCopy {
  if (role === "SUPPLIER") return getRadarCopyForSupplier(winner, country, locale)
  return getRadarCopyForAffiliate(winner, country, locale)
}

export function isRadarSupplierRole(role: string | null | undefined): boolean {
  return role === "SUPPLIER"
}

/** Bulk sticky bar label */
export function radarBulkBarLabel(args: {
  role: string | null | undefined
  count: number
  marginEuro?: number
  locale?: AppLocale
}): string {
  const n = args.count
  const locale = args.locale ?? "fr"
  if (isRadarSupplierRole(args.role)) return tr(locale, "bulkSupplier", { n })
  const margin =
    args.marginEuro != null ? formatEnrichEuro(args.marginEuro) : "215,00"
  return tr(locale, "bulkAffiliate", { n, margin })
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
