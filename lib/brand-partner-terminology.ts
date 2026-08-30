import type { AppLocale } from "@/lib/i18n-locale"

/**
 * Canonical Affisell partner positioning — Affiliates = resellers AND creators.
 * Use in code when a slash label is needed; prefer i18n keys for user-facing copy.
 */
export const BRAND_PARTNER_SLASH: Record<AppLocale, string> = {
  en: "Resellers / Creators",
  fr: "Revendeurs / Créateurs",
  de: "Reseller / Creator",
  es: "Revendedores / Creadores",
  it: "Rivenditori / Creator",
  nl: "Resellers / Creators",
  pl: "Resellerzy / Creatorzy",
  zh: "经销商 / 创作者",
}

export const BRAND_PARTNER_AND: Record<AppLocale, string> = {
  en: "resellers & creators",
  fr: "revendeurs & créateurs",
  de: "Reseller & Creator",
  es: "revendedores y creadores",
  it: "rivenditori e creator",
  nl: "resellers & creators",
  pl: "resellerzy i creatorzy",
  zh: "经销商与创作者",
}
