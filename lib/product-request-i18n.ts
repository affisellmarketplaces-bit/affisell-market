import type { DeliverySlaBand } from "@/lib/logistics/delivery-sla"
import { getAggregatedSlaForCountries, getSLAForCountry } from "@/lib/logistics/delivery-sla"
import type { AppLocale } from "@/lib/i18n-locale"
import { resolveAppLocale } from "@/lib/i18n-locale"

export const PRODUCT_REQUEST_CATEGORY_IDS = [
  "baby",
  "auto",
  "fitness",
  "beauty",
  "tech",
  "home",
  "fashion",
  "general",
] as const

export type ProductRequestCategoryId = (typeof PRODUCT_REQUEST_CATEGORY_IDS)[number]

export const PRODUCT_REQUEST_REGION_IDS = [
  "Europe",
  "America",
  "Asia",
  "Africa",
  "Oceania",
  "other",
] as const

export type ProductRequestRegionId = (typeof PRODUCT_REQUEST_REGION_IDS)[number]

export type ProductRequestTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string

/** ICU-safe relative time for lists (server + client). */
export function formatProductRequestRelativeTime(
  iso: string | Date,
  locale?: string | null
): string {
  const resolved = resolveAppLocale(locale ?? undefined)
  const d = typeof iso === "string" ? new Date(iso) : iso
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  const rtf = new Intl.RelativeTimeFormat(resolved, { numeric: "auto" })
  if (mins < 1) return rtf.format(0, "second")
  if (mins < 60) return rtf.format(-mins, "minute")
  const hours = Math.floor(mins / 60)
  if (hours < 48) return rtf.format(-hours, "hour")
  const days = Math.floor(hours / 24)
  return rtf.format(-days, "day")
}

/** @deprecated Use formatProductRequestRelativeTime */
export function formatRequestRelativeFr(iso: string | Date): string {
  return formatProductRequestRelativeTime(iso, "fr")
}

export function buildResellerSlaHint(
  countryCodes: readonly string[],
  t: ProductRequestTranslator
): string {
  const codes =
    countryCodes.length > 0
      ? countryCodes.map((c) => c.trim().toUpperCase())
      : ["FR"]
  if (codes.length <= 1) {
    const code = codes[0] ?? "FR"
    const sla = getSLAForCountry(code)
    return t("sla.singleMarket", {
      code,
      idealDays: sla.idealDays,
      maxDays: sla.maxDays,
    })
  }
  const agg = getAggregatedSlaForCountries(codes)
  const perMarket = codes
    .map((code) => {
      const sla = getSLAForCountry(code)
      return t("sla.perMarketLine", {
        code,
        idealDays: sla.idealDays,
        maxDays: sla.maxDays,
      })
    })
    .join(" · ")
  return t("sla.multiMarket", {
    codes: codes.join(", "),
    perMarket,
    maxDays: agg.maxDays,
  })
}

export function priorityDaysLabel(
  priority: "speed" | "balanced" | "price",
  sla: DeliverySlaBand,
  t: ProductRequestTranslator
): string {
  if (priority === "speed") return t("priorities.daysSpeed", { days: sla.idealDays })
  if (priority === "price") {
    return t("priorities.daysPrice", { days: Math.max(sla.maxDays, 10) })
  }
  return t("priorities.daysBalanced", { days: sla.maxDays })
}

export function productRequestStatusKey(status: string): string {
  const s = status.trim().toLowerCase()
  if (s === "open" || s === "fulfilled" || s === "closed") return s
  return "other"
}

export function buildSupplierDeliveryFeedbackCopy(
  deliveryDays: number,
  countryCodes: readonly string[],
  t: ProductRequestTranslator
): { tone: "boost" | "ok" | "warn"; message: string } {
  const codes =
    countryCodes.length > 0
      ? countryCodes.map((c) => c.trim().toUpperCase())
      : ["FR"]
  const days = Math.max(0, Math.round(deliveryDays))
  const parts = codes.map((code) => {
    const sla = getSLAForCountry(code)
    let tone: "boost" | "ok" | "warn" = "warn"
    let message = ""
    if (days <= sla.idealDays) {
      tone = "boost"
      message = t("supplierFeedback.boost", { code, maxDays: sla.maxDays, days })
    } else if (days <= sla.maxDays) {
      tone = "ok"
      message = t("supplierFeedback.ok", { code, maxDays: sla.maxDays, days })
    } else {
      tone = "warn"
      message = t("supplierFeedback.warn", { code, maxDays: sla.maxDays, days })
    }
    return { tone, message }
  })
  const toneRank = { warn: 0, ok: 1, boost: 2 } as const
  const worst = parts.reduce((a, b) => (toneRank[a.tone] < toneRank[b.tone] ? a : b))
  if (codes.length <= 1) return worst
  return {
    tone: worst.tone,
    message: t("supplierFeedback.allMarkets", {
      detail: worst.message,
      codes: codes.join(", "),
    }),
  }
}

export function resolveProductRequestLocale(raw: string | null | undefined): AppLocale {
  return resolveAppLocale(raw)
}
