/**
 * Radar UI copy — no-stock / reseller-first (never “Grossiste” for affiliates).
 */

export const RADAR_NO_STOCK_TOOLTIP =
  "Comment ça marche sans stock? Tu listes à 36,75€. Quand tu vends, Affisell achète à 11,55€ chez le fournisseur EU et livre ton client. Tu touches 25,20€. 0 stock, 0 avance."

/** Example economics shown on high-arbitrage FR rows. */
export const RADAR_NO_STOCK_ECONOMICS = {
  listPrice: "36,75€",
  costAfterSale: "11,55€",
  profit: "25,20€",
} as const

export function radarArbitrageGoldLabel(score: number): string {
  return `🔥 ${score}/100 - Marché Vierge FR`
}

export function radarArbitrageGoldHint(): string {
  const e = RADAR_NO_STOCK_ECONOMICS
  return `Tu vends à ${e.listPrice}, tu payes ${e.costAfterSale} après vente = +${e.profit} sans stock`
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

export function radarSupplierMatchEmptyCopy(): string {
  return `💜 Marché Vierge FR - 0 concurrent - Lancement 1er sans stock →`
}

export function radarSupplierMatchPositiveCopy(count: number): string {
  if (count >= 3) {
    return `✅ ${count} fournisseurs EU - 4j - Sans stock`
  }
  if (count === 2) {
    return `✅ ${count} fournisseurs EU - Sans stock`
  }
  return `✅ ${count} fournisseur EU - Sans stock`
}

export function radarEuSuppliersFastLabel(): string {
  return `✅ 3 fournisseurs EU - 4j - Sans stock`
}

export function radarActionCtaLabel(role: string | null | undefined): string {
  if (role === "AFFILIATE") return "Lister sans stock →"
  return "Sourcer →"
}

export function radarActionCtaHref(role: string | null | undefined, country: string): string {
  if (role === "AFFILIATE") return "/dashboard/affiliate/catalog?filter=draft"
  if (role === "SUPPLIER") return "/dashboard/supplier/products/new"
  return `/radar/winners?country=${encodeURIComponent(country)}`
}
