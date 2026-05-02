const COUNTRY_LABEL: Record<string, string> = {
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  US: "United States",
  CN: "China",
  UK: "United Kingdom",
}

export function shippingCountryLabel(code: string | null | undefined): string {
  if (!code) return "—"
  return COUNTRY_LABEL[code.toUpperCase()] ?? code
}
