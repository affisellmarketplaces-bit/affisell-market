export type RadarRegion = "Europe" | "America" | "Asia" | "Africa" | "Oceania"

export type WorldCountryDef = {
  code: string
  name: string
  flag: string
  region: RadarRegion
  currency: string
  enabled: boolean
}

/** 30 primary World Radar markets — seeded idempotently. */
export const WORLD_RADAR_COUNTRIES: WorldCountryDef[] = [
  { code: "FR", name: "France", flag: "🇫🇷", region: "Europe", currency: "EUR", enabled: true },
  { code: "DE", name: "Allemagne", flag: "🇩🇪", region: "Europe", currency: "EUR", enabled: true },
  { code: "UK", name: "Royaume-Uni", flag: "🇬🇧", region: "Europe", currency: "GBP", enabled: true },
  { code: "IT", name: "Italie", flag: "🇮🇹", region: "Europe", currency: "EUR", enabled: true },
  { code: "ES", name: "Espagne", flag: "🇪🇸", region: "Europe", currency: "EUR", enabled: true },
  { code: "NL", name: "Pays-Bas", flag: "🇳🇱", region: "Europe", currency: "EUR", enabled: true },
  { code: "BE", name: "Belgique", flag: "🇧🇪", region: "Europe", currency: "EUR", enabled: true },
  { code: "PL", name: "Pologne", flag: "🇵🇱", region: "Europe", currency: "PLN", enabled: true },
  { code: "PT", name: "Portugal", flag: "🇵🇹", region: "Europe", currency: "EUR", enabled: true },
  { code: "SE", name: "Suède", flag: "🇸🇪", region: "Europe", currency: "SEK", enabled: true },
  { code: "US", name: "États-Unis", flag: "🇺🇸", region: "America", currency: "USD", enabled: true },
  { code: "CA", name: "Canada", flag: "🇨🇦", region: "America", currency: "CAD", enabled: true },
  { code: "MX", name: "Mexique", flag: "🇲🇽", region: "America", currency: "MXN", enabled: true },
  { code: "BR", name: "Brésil", flag: "🇧🇷", region: "America", currency: "BRL", enabled: true },
  { code: "AR", name: "Argentine", flag: "🇦🇷", region: "America", currency: "ARS", enabled: true },
  { code: "CO", name: "Colombie", flag: "🇨🇴", region: "America", currency: "COP", enabled: true },
  { code: "JP", name: "Japon", flag: "🇯🇵", region: "Asia", currency: "JPY", enabled: true },
  { code: "KR", name: "Corée du Sud", flag: "🇰🇷", region: "Asia", currency: "KRW", enabled: true },
  { code: "IN", name: "Inde", flag: "🇮🇳", region: "Asia", currency: "INR", enabled: true },
  { code: "ID", name: "Indonésie", flag: "🇮🇩", region: "Asia", currency: "IDR", enabled: true },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", region: "Asia", currency: "VND", enabled: true },
  { code: "SG", name: "Singapour", flag: "🇸🇬", region: "Asia", currency: "SGD", enabled: true },
  { code: "CN", name: "Chine", flag: "🇨🇳", region: "Asia", currency: "CNY", enabled: true },
  { code: "AE", name: "Émirats", flag: "🇦🇪", region: "Africa", currency: "AED", enabled: true },
  { code: "SA", name: "Arabie Saoudite", flag: "🇸🇦", region: "Africa", currency: "SAR", enabled: true },
  { code: "MA", name: "Maroc", flag: "🇲🇦", region: "Africa", currency: "MAD", enabled: true },
  { code: "ZA", name: "Afrique du Sud", flag: "🇿🇦", region: "Africa", currency: "ZAR", enabled: true },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", region: "Africa", currency: "NGN", enabled: true },
  { code: "EG", name: "Égypte", flag: "🇪🇬", region: "Africa", currency: "EGP", enabled: true },
  { code: "AU", name: "Australie", flag: "🇦🇺", region: "Oceania", currency: "AUD", enabled: true },
  { code: "NZ", name: "Nouvelle-Zélande", flag: "🇳🇿", region: "Oceania", currency: "NZD", enabled: true },
]

export const WORLD_RADAR_SCAN_ROTATION = [
  "FR",
  "DE",
  "US",
  "UK",
  "JP",
  "BR",
  "MA",
  "AE",
  "IN",
  "ES",
  "IT",
  "CA",
  "MX",
  "KR",
  "ZA",
  "AU",
] as const

export function getWorldCountry(code: string): WorldCountryDef | undefined {
  const normalized = code.trim().toUpperCase()
  return WORLD_RADAR_COUNTRIES.find((c) => c.code === normalized)
}

export function groupCountriesByRegion(
  countries: Array<WorldCountryDef & { productCount?: number; lastScanAt?: Date | null }>
): Record<RadarRegion, typeof countries> {
  const grouped: Record<RadarRegion, typeof countries> = {
    Europe: [],
    America: [],
    Asia: [],
    Africa: [],
    Oceania: [],
  }
  for (const c of countries) {
    grouped[c.region].push(c)
  }
  return grouped
}

export function getCountriesForCronBatch(batchIndex: number, batchSize = 5): string[] {
  const pool = [...WORLD_RADAR_SCAN_ROTATION]
  const start = (batchIndex % Math.ceil(pool.length / batchSize)) * batchSize
  return pool.slice(start, start + batchSize)
}
