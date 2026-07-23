/**
 * Radar Price Veil — reseller market prices stay affiliate-only.
 * SUPPLIER sees demand / wholesale opportunity signals, never vitrine €.
 */

import type { WorldRadarWinnerDto } from "@/lib/radar/world-radar-types"
import { isRadarSupplierRole } from "@/lib/radar/radar-copy"

export type RadarPriceAudience = "reseller" | "supplier" | "public"

export function radarPriceAudience(role: string | null | undefined): RadarPriceAudience {
  if (isRadarSupplierRole(role)) return "supplier"
  if (role === "AFFILIATE" || role === "ADMIN") return "reseller"
  return "public"
}

/** Reseller / marketplace list price visibility. */
export function canViewResellerMarketPrice(role: string | null | undefined): boolean {
  return radarPriceAudience(role) !== "supplier"
}

export function canViewResellerMargin(role: string | null | undefined): boolean {
  return canViewResellerMarketPrice(role)
}

export function radarPriceColumnLabel(role: string | null | undefined): string {
  return canViewResellerMarketPrice(role) ? "Prix" : "Signal"
}

function formatSearchesShort(searches: number | null | undefined): string {
  if (searches == null || !Number.isFinite(searches) || searches <= 0) return "Demande"
  if (searches >= 1_000_000) return `${(searches / 1_000_000).toFixed(1)}M`
  if (searches >= 1_000) return `${Math.round(searches / 1_000)}k`
  return String(Math.round(searches))
}

/** Compact demand chip replacing market € for suppliers. */
export function formatSupplierDemandSignal(row: {
  searches?: number | null
  growthRate?: number | null
  competition?: number | null
}): string {
  const vol = formatSearchesShort(row.searches)
  const hot = row.growthRate != null && row.growthRate > 40
  const open = row.competition != null && row.competition < 5
  if (hot && open) return `🔥 ${vol} · Zone ouverte`
  if (hot) return `⚡ ${vol} recherches`
  if (open) return `◈ ${vol} · Peu saturé`
  return `◈ ${vol} · Demande`
}

export function supplierDemandTooltip(row: {
  searches?: number | null
  countryCode?: string | null
}): string {
  const code = row.countryCode?.trim().toUpperCase() || "FR"
  const vol = formatSearchesShort(row.searches)
  return `Prix vitrine réservé aux revendeurs Affisell. Signal fournisseur: ${vol} recherches/mois (${code}) — positionne ton stock exclusif.`
}

/**
 * Server-side redaction — never send reseller € to SUPPLIER clients.
 * Idempotent: safe to call twice.
 */
export function redactRadarWinnerForRole(
  winner: WorldRadarWinnerDto,
  role: string | null | undefined
): WorldRadarWinnerDto {
  if (canViewResellerMarketPrice(role)) return winner
  return {
    ...winner,
    price: null,
    priceVeiled: true,
  }
}

export function redactRadarPayloadForRole<T extends { winners: WorldRadarWinnerDto[] }>(
  payload: T,
  role: string | null | undefined
): T {
  if (canViewResellerMarketPrice(role)) return payload
  return {
    ...payload,
    winners: payload.winners.map((w) => redactRadarWinnerForRole(w, role)),
  }
}
