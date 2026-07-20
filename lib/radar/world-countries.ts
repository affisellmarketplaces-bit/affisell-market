export type RadarRegion = "Europe" | "America" | "Asia" | "Africa" | "Oceania"

export type WorldCountryDef = {
  code: string
  name: string
  flag: string
  region: RadarRegion
  currency: string
  enabled: boolean
  /** Preferred product categories for pool filtering */
  trendingCategories: string[]
}

/** 31 primary World Radar markets — seeded idempotently. */
export const WORLD_RADAR_COUNTRIES: WorldCountryDef[] = [
  { code: "FR", name: "France", flag: "🇫🇷", region: "Europe", currency: "EUR", enabled: true, trendingCategories: ["baby", "kitchen_gadget", "wellness", "beauty", "eco_home"] },
  { code: "DE", name: "Allemagne", flag: "🇩🇪", region: "Europe", currency: "EUR", enabled: true, trendingCategories: ["eco_home", "car_accessories", "office", "fitness", "kitchen_gadget"] },
  { code: "UK", name: "Royaume-Uni", flag: "🇬🇧", region: "Europe", currency: "GBP", enabled: true, trendingCategories: ["kitchen_gadget", "home_deco", "pet", "fitness", "outdoor"] },
  { code: "IT", name: "Italie", flag: "🇮🇹", region: "Europe", currency: "EUR", enabled: true, trendingCategories: ["beauty", "home_deco", "kitchen_gadget", "party_deco"] },
  { code: "ES", name: "Espagne", flag: "🇪🇸", region: "Europe", currency: "EUR", enabled: true, trendingCategories: ["beauty", "home_deco", "party_deco", "kitchen_gadget"] },
  { code: "NL", name: "Pays-Bas", flag: "🇳🇱", region: "Europe", currency: "EUR", enabled: true, trendingCategories: ["eco_home", "outdoor", "office", "car_accessories"] },
  { code: "BE", name: "Belgique", flag: "🇧🇪", region: "Europe", currency: "EUR", enabled: true, trendingCategories: ["beauty", "kitchen_gadget", "eco_home", "baby"] },
  { code: "PL", name: "Pologne", flag: "🇵🇱", region: "Europe", currency: "PLN", enabled: true, trendingCategories: ["home_deco", "phone_accessories", "fitness", "kitchen_gadget"] },
  { code: "PT", name: "Portugal", flag: "🇵🇹", region: "Europe", currency: "EUR", enabled: true, trendingCategories: ["beauty", "home_deco", "kitchen_gadget"] },
  { code: "SE", name: "Suède", flag: "🇸🇪", region: "Europe", currency: "SEK", enabled: true, trendingCategories: ["eco_home", "office", "outdoor", "fitness"] },
  { code: "US", name: "États-Unis", flag: "🇺🇸", region: "America", currency: "USD", enabled: true, trendingCategories: ["outdoor", "fitness", "car_accessories", "pet", "kitchen_gadget"] },
  { code: "CA", name: "Canada", flag: "🇨🇦", region: "America", currency: "CAD", enabled: true, trendingCategories: ["outdoor", "pet", "fitness", "home_deco"] },
  { code: "MX", name: "Mexique", flag: "🇲🇽", region: "America", currency: "MXN", enabled: true, trendingCategories: ["party_deco", "beauty", "phone_accessories", "kitchen_gadget"] },
  { code: "BR", name: "Brésil", flag: "🇧🇷", region: "America", currency: "BRL", enabled: true, trendingCategories: ["beauty", "party_deco", "phone_accessories", "fitness"] },
  { code: "AR", name: "Argentine", flag: "🇦🇷", region: "America", currency: "ARS", enabled: true, trendingCategories: ["beauty", "party_deco", "home_deco"] },
  { code: "CO", name: "Colombie", flag: "🇨🇴", region: "America", currency: "COP", enabled: true, trendingCategories: ["party_deco", "beauty", "phone_accessories"] },
  { code: "JP", name: "Japon", flag: "🇯🇵", region: "Asia", currency: "JPY", enabled: true, trendingCategories: ["kawaii_tech", "beauty", "pet", "wellness"] },
  { code: "KR", name: "Corée du Sud", flag: "🇰🇷", region: "Asia", currency: "KRW", enabled: true, trendingCategories: ["beauty", "kawaii_tech", "phone_accessories", "wellness"] },
  { code: "IN", name: "Inde", flag: "🇮🇳", region: "Asia", currency: "INR", enabled: true, trendingCategories: ["modest_fashion", "phone_accessories", "kitchen_gadget", "home_deco"] },
  { code: "ID", name: "Indonésie", flag: "🇮🇩", region: "Asia", currency: "IDR", enabled: true, trendingCategories: ["modest_fashion", "phone_accessories", "beauty", "kitchen_gadget"] },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", region: "Asia", currency: "VND", enabled: true, trendingCategories: ["phone_accessories", "kitchen_gadget", "outdoor", "beauty"] },
  { code: "SG", name: "Singapour", flag: "🇸🇬", region: "Asia", currency: "SGD", enabled: true, trendingCategories: ["kawaii_tech", "beauty", "office", "home_deco"] },
  { code: "CN", name: "Chine", flag: "🇨🇳", region: "Asia", currency: "CNY", enabled: true, trendingCategories: ["phone_accessories", "kawaii_tech", "kitchen_gadget", "home_deco", "office"] },
  { code: "AE", name: "Émirats", flag: "🇦🇪", region: "Africa", currency: "AED", enabled: true, trendingCategories: ["modest_fashion", "car_accessories", "home_deco", "beauty"] },
  { code: "SA", name: "Arabie Saoudite", flag: "🇸🇦", region: "Africa", currency: "SAR", enabled: true, trendingCategories: ["modest_fashion", "car_accessories", "home_deco", "beauty"] },
  { code: "MA", name: "Maroc", flag: "🇲🇦", region: "Africa", currency: "MAD", enabled: true, trendingCategories: ["modest_fashion", "beauty", "home_deco", "phone_accessories"] },
  { code: "ZA", name: "Afrique du Sud", flag: "🇿🇦", region: "Africa", currency: "ZAR", enabled: true, trendingCategories: ["outdoor", "phone_accessories", "car_accessories", "home_deco"] },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", region: "Africa", currency: "NGN", enabled: true, trendingCategories: ["phone_accessories", "outdoor", "beauty", "home_deco"] },
  { code: "EG", name: "Égypte", flag: "🇪🇬", region: "Africa", currency: "EGP", enabled: true, trendingCategories: ["modest_fashion", "home_deco", "beauty", "phone_accessories"] },
  { code: "AU", name: "Australie", flag: "🇦🇺", region: "Oceania", currency: "AUD", enabled: true, trendingCategories: ["outdoor", "fitness", "pet", "car_accessories"] },
  { code: "NZ", name: "Nouvelle-Zélande", flag: "🇳🇿", region: "Oceania", currency: "NZD", enabled: true, trendingCategories: ["outdoor", "fitness", "eco_home", "pet"] },
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
  countries: Array<{
    code: string
    name: string
    flag: string
    region: RadarRegion
    currency: string
    enabled: boolean
    productCount?: number
    lastScanAt?: Date | null
    trendingCategories?: string[]
  }>
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
