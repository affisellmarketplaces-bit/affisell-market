const COUNTRY_LABEL: Record<string, string> = {
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  US: "United States",
  CN: "China",
  GB: "United Kingdom",
  BE: "Belgium",
  NL: "Netherlands",
  PT: "Portugal",
  CH: "Switzerland",
  CA: "Canada",
  PL: "Poland",
}

export function shippingCountryLabel(code: string | null | undefined): string {
  if (!code) return "—"
  return COUNTRY_LABEL[code.toUpperCase()] ?? code
}
