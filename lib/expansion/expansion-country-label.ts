import { visitorCountryDisplayName } from "@/lib/visitor-country"

export function expansionCountryLabel(countryIso2: string, locale: "en" | "fr" = "en"): string {
  return visitorCountryDisplayName(countryIso2, locale)
}
