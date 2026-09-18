/**
 * Delivery SLA by continent / market — reseller-first.
 * Used by Product Requests, Radar copy, and supplier quote UX.
 */

import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"

const RT = "radarTerminal"

function tr(locale: AppLocale, key: string, vars: Record<string, string | number> = {}): string {
  let out = tMessage(locale, `${RT}.${key}`)
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

export type DeliverySlaColor = "green" | "orange" | "red"

export type DeliverySlaBand = {
  maxDays: number
  idealDays: number
  label: string
  priority: 1 | 2 | 3
  color: DeliverySlaColor
  countries?: readonly string[]
}

export type DeliverySlaKey =
  | "EU"
  | "US"
  | "CA"
  | "GCC"
  | "JP"
  | "KR"
  | "SG"
  | "LATAM"
  | "AFRICA"
  | "OTHER"

export const DELIVERY_SLA_BY_CONTINENT: Record<DeliverySlaKey, DeliverySlaBand> = {
  EU: { maxDays: 5, idealDays: 3, label: "EU Express", priority: 1, color: "green" },
  US: { maxDays: 7, idealDays: 4, label: "US Fast", priority: 2, color: "green" },
  CA: { maxDays: 8, idealDays: 5, label: "CA Standard", priority: 2, color: "green" },
  GCC: {
    maxDays: 8,
    idealDays: 5,
    label: "GCC Express",
    priority: 1,
    color: "green",
    countries: ["SA", "AE", "QA", "KW", "BH", "OM"],
  },
  JP: { maxDays: 6, idealDays: 4, label: "JP Express", priority: 2, color: "green" },
  KR: { maxDays: 7, idealDays: 5, label: "KR Fast", priority: 2, color: "green" },
  SG: { maxDays: 7, idealDays: 5, label: "SG Fast", priority: 2, color: "green" },
  LATAM: {
    maxDays: 12,
    idealDays: 8,
    label: "LATAM",
    priority: 3,
    color: "orange",
    countries: ["BR", "MX", "AR", "CL", "CO"],
  },
  AFRICA: { maxDays: 15, idealDays: 10, label: "Africa", priority: 3, color: "orange" },
  OTHER: { maxDays: 15, idealDays: 10, label: "Standard", priority: 3, color: "red" },
}

/** Maps ISO / Radar codes → SLA band (31 World Radar markets + EU extras). */
export const COUNTRY_TO_SLA: Record<string, DeliverySlaKey> = {
  // Europe (Radar + common)
  FR: "EU",
  DE: "EU",
  IT: "EU",
  ES: "EU",
  NL: "EU",
  BE: "EU",
  PL: "EU",
  PT: "EU",
  SE: "EU",
  UK: "EU",
  GB: "EU",
  AT: "EU",
  IE: "EU",
  DK: "EU",
  FI: "EU",
  CZ: "EU",
  RO: "EU",
  HU: "EU",
  GR: "EU",
  // North America
  US: "US",
  CA: "CA",
  // GCC
  SA: "GCC",
  AE: "GCC",
  QA: "GCC",
  KW: "GCC",
  BH: "GCC",
  OM: "GCC",
  // Asia developed
  JP: "JP",
  KR: "KR",
  SG: "SG",
  // LATAM
  BR: "LATAM",
  MX: "LATAM",
  AR: "LATAM",
  CL: "LATAM",
  CO: "LATAM",
  // Africa (Radar)
  MA: "AFRICA",
  ZA: "AFRICA",
  NG: "AFRICA",
  EG: "AFRICA",
  // Asia emerging / Oceania → OTHER (longer SLA)
  IN: "OTHER",
  ID: "OTHER",
  VN: "OTHER",
  CN: "OTHER",
  AU: "OTHER",
  NZ: "OTHER",
}

export type DeliveryPriority = "speed" | "balanced" | "price"

export type DeliveryScore = {
  score: number
  label: string
  color: DeliverySlaColor
  slaKey: DeliverySlaKey
  sla: DeliverySlaBand
  emoji: string
}

export function normalizeCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase() || "FR"
}

export function getSlaKeyForCountry(countryCode: string): DeliverySlaKey {
  const code = normalizeCountryCode(countryCode)
  return COUNTRY_TO_SLA[code] ?? "OTHER"
}

export function getSLAForCountry(countryCode: string): DeliverySlaBand {
  return DELIVERY_SLA_BY_CONTINENT[getSlaKeyForCountry(countryCode)]
}

export function getDeliveryScore(
  deliveryDays: number,
  countryCode: string,
  locale: AppLocale = "fr"
): DeliveryScore {
  const slaKey = getSlaKeyForCountry(countryCode)
  const sla = DELIVERY_SLA_BY_CONTINENT[slaKey]
  const days = Number.isFinite(deliveryDays) ? Math.max(0, Math.round(deliveryDays)) : 999

  if (days <= sla.idealDays) {
    return { score: 100, label: tr(locale, "deliveryIdeal"), color: "green", slaKey, sla, emoji: "🟢" }
  }
  if (days <= sla.maxDays) {
    return { score: 70, label: tr(locale, "deliveryReasonable"), color: "orange", slaKey, sla, emoji: "🟠" }
  }
  return { score: 30, label: tr(locale, "deliveryTooSlow"), color: "red", slaKey, sla, emoji: "🔴" }
}

export function isDeliveryAcceptable(deliveryDays: number, countryCode: string): boolean {
  return deliveryDays <= getSLAForCountry(countryCode).maxDays
}

/** Reseller form: map priority → max acceptable days stored on ProductRequest.deliverySLA */
export function resolveDeliverySLA(
  countryCode: string,
  priority: DeliveryPriority = "balanced"
): number {
  const sla = getSLAForCountry(countryCode)
  if (priority === "speed") return sla.idealDays
  if (priority === "price") return Math.max(sla.maxDays, 10)
  return sla.maxDays
}

export function parseDeliveryPriority(raw: unknown): DeliveryPriority {
  if (raw === "speed" || raw === "balanced" || raw === "price") return raw
  return "balanced"
}

export function getResellerSlaHint(countryCode: string): string {
  const code = normalizeCountryCode(countryCode)
  const sla = getSLAForCountry(code)
  return `Pour ${code}, délai raisonnable: ${sla.idealDays}-${sla.maxDays}j. Au-delà de ${sla.maxDays}j, ton taux de retour augmente de 40%.`
}

export function getAggregatedSlaForCountries(
  countryCodes: readonly string[]
): DeliverySlaBand & { countryCodes: string[] } {
  const codes =
    countryCodes.length > 0
      ? countryCodes.map((c) => normalizeCountryCode(c))
      : ["FR"]
  const slas = codes.map(getSLAForCountry)
  return {
    idealDays: Math.min(...slas.map((s) => s.idealDays)),
    maxDays: Math.max(...slas.map((s) => s.maxDays)),
    label: [...new Set(slas.map((s) => s.label))].join(" / "),
    priority: Math.max(...slas.map((s) => s.priority)) as 1 | 2 | 3,
    color: slas.some((s) => s.color === "red")
      ? "red"
      : slas.some((s) => s.color === "orange")
        ? "orange"
        : "green",
    countryCodes: codes,
  }
}

export function getResellerSlaHintForCountries(countryCodes: readonly string[]): string {
  const codes =
    countryCodes.length > 0
      ? countryCodes.map((c) => normalizeCountryCode(c))
      : ["FR"]
  if (codes.length <= 1) return getResellerSlaHint(codes[0] ?? "FR")
  const agg = getAggregatedSlaForCountries(codes)
  const perMarket = codes
    .map((code) => {
      const sla = getSLAForCountry(code)
      return `${code} ${sla.idealDays}-${sla.maxDays}j`
    })
    .join(" · ")
  return `Marchés ${codes.join(", ")} — délais raisonnables: ${perMarket}. SLA combiné max ${agg.maxDays}j. Au-delà, ton taux de retour augmente de 40%.`
}

export function resolveDeliverySLAForCountries(
  countryCodes: readonly string[],
  priority: DeliveryPriority = "balanced"
): number {
  const codes =
    countryCodes.length > 0
      ? countryCodes.map((c) => normalizeCountryCode(c))
      : ["FR"]
  return Math.max(...codes.map((c) => resolveDeliverySLA(c, priority)))
}

export function isDeliveryAcceptableForCountries(
  deliveryDays: number,
  countryCodes: readonly string[]
): boolean {
  const codes =
    countryCodes.length > 0
      ? countryCodes.map((c) => normalizeCountryCode(c))
      : ["FR"]
  return codes.every((c) => isDeliveryAcceptable(deliveryDays, c))
}

export function getDeliveryScoreForCountries(
  deliveryDays: number,
  countryCodes: readonly string[],
  locale: AppLocale = "fr"
): DeliveryScore {
  const codes =
    countryCodes.length > 0
      ? countryCodes.map((c) => normalizeCountryCode(c))
      : ["FR"]
  return codes
    .map((c) => getDeliveryScore(deliveryDays, c, locale))
    .reduce((worst, scored) => (scored.score < worst.score ? scored : worst))
}

export function getSupplierDeliveryFeedbackForCountries(
  deliveryDays: number,
  countryCodes: readonly string[]
): { tone: "boost" | "ok" | "warn"; message: string } {
  const codes =
    countryCodes.length > 0
      ? countryCodes.map((c) => normalizeCountryCode(c))
      : ["FR"]
  const parts = codes.map((c) => getSupplierDeliveryFeedback(deliveryDays, c))
  const toneRank = { warn: 0, ok: 1, boost: 2 } as const
  const worst = parts.reduce((a, b) => (toneRank[a.tone] < toneRank[b.tone] ? a : b))
  if (codes.length <= 1) return worst
  return {
    tone: worst.tone,
    message: `${worst.message} (tous marchés: ${codes.join(", ")})`,
  }
}

export function getSupplierDeliveryFeedback(
  deliveryDays: number,
  countryCode: string
): { tone: "boost" | "ok" | "warn"; message: string } {
  const code = normalizeCountryCode(countryCode)
  const sla = getSLAForCountry(code)
  const days = Math.max(0, Math.round(deliveryDays))

  if (days <= sla.idealDays) {
    return {
      tone: "boost",
      message: `Pour ${code}, max raisonnable = ${sla.maxDays}j. Tu proposes ${days}j → 🟢 Boost visibilité +30%`,
    }
  }
  if (days <= sla.maxDays) {
    return {
      tone: "ok",
      message: `Pour ${code}, max raisonnable = ${sla.maxDays}j. Tu proposes ${days}j → ✅ Dans la zone acceptable`,
    }
  }
  return {
    tone: "warn",
    message: `Tu proposes ${days}j → 🔴 -50% visibilité, reseller risque de refuser (max ${sla.maxDays}j pour ${code})`,
  }
}

/** Quote table cell: "🟢 3j ⚡ Idéal (EU)" / "🔴 12j ⚠️ Trop lent pour FR (max 5j)" */
export function formatQuoteDeliveryCell(
  deliveryDays: number,
  countryCode: string,
  locale: AppLocale = "fr"
): string {
  const code = normalizeCountryCode(countryCode)
  const scored = getDeliveryScore(deliveryDays, code, locale)
  const days = tr(locale, "dayShort", { n: deliveryDays })
  if (scored.score >= 70) {
    return `${scored.emoji} ${days} ${scored.label} (${scored.slaKey})`
  }
  return tr(locale, "quoteTooSlow", {
    emoji: scored.emoji,
    days,
    label: scored.label,
    code,
    max: tr(locale, "dayShort", { n: scored.sla.maxDays }),
  })
}

/**
 * Radar supplier chip with SLA vs market country.
 * EU fast path vs CN slow path examples from product brief.
 */
export function formatRadarSupplierDeliveryLine(args: {
  count: number
  marketCountry: string
  origin?: "EU" | "CN"
  days?: number
  locale?: AppLocale
}): string {
  const locale = args.locale ?? "fr"
  const code = normalizeCountryCode(args.marketCountry)
  const count = Math.max(0, args.count)
  const origin = args.origin ?? "EU"
  const days =
    args.days ??
    (origin === "EU" ? getSLAForCountry(code).idealDays : getSLAForCountry("CN").maxDays)
  const scored = getDeliveryScore(days, code, locale)
  const vars = {
    count,
    noun: tr(locale, count > 1 ? "supplierMany" : "supplierOne"),
    origin,
    days: tr(locale, "dayShort", { n: days }),
    label: scored.label,
    code,
    max: tr(locale, "dayShort", { n: scored.sla.maxDays }),
  }
  if (origin === "CN" || scored.score < 70) return tr(locale, "deliveryLineWarn", vars)
  return tr(locale, "deliveryLineOk", vars)
}

export function sortQuotesByDeliveryThenPrice<T extends { deliveryDays: number; price: number }>(
  quotes: T[],
  countryCode: string
): T[] {
  return [...quotes].sort((a, b) => {
    const sa = getDeliveryScore(a.deliveryDays, countryCode).score
    const sb = getDeliveryScore(b.deliveryDays, countryCode).score
    if (sb !== sa) return sb - sa
    return a.price - b.price
  })
}
