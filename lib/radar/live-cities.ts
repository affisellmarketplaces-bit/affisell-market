/** Hardcoded city coords for Globe pins (MVP — no Mapbox). */

export type GlobeCity = {
  city: string
  country: string
  countryCode: string
  lat: number
  lng: number
}

export const GLOBE_DEMO_CITIES: readonly GlobeCity[] = [
  { city: "Paris", country: "France", countryCode: "FR", lat: 48.8566, lng: 2.3522 },
  { city: "Berlin", country: "Germany", countryCode: "DE", lat: 52.52, lng: 13.405 },
  { city: "Munich", country: "Germany", countryCode: "DE", lat: 48.1351, lng: 11.582 },
  { city: "Madrid", country: "Spain", countryCode: "ES", lat: 40.4168, lng: -3.7038 },
  { city: "Rome", country: "Italy", countryCode: "IT", lat: 41.9028, lng: 12.4964 },
  { city: "Londres", country: "United Kingdom", countryCode: "GB", lat: 51.5074, lng: -0.1278 },
  { city: "Rio", country: "Brazil", countryCode: "BR", lat: -22.9068, lng: -43.1729 },
  { city: "NYC", country: "United States", countryCode: "US", lat: 40.7128, lng: -74.006 },
  { city: "Dubaï", country: "United Arab Emirates", countryCode: "AE", lat: 25.2048, lng: 55.2708 },
  { city: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6762, lng: 139.6503 },
] as const

/** Country ISO2 → primary demo city (for mapping real orders). */
const COUNTRY_PRIMARY_CITY: Record<string, GlobeCity> = Object.fromEntries(
  GLOBE_DEMO_CITIES.map((c) => [c.countryCode, c])
)

export function cityForCountryCode(code: string | null | undefined): GlobeCity {
  const cc = (code ?? "FR").trim().toUpperCase()
  if (COUNTRY_PRIMARY_CITY[cc]) return COUNTRY_PRIMARY_CITY[cc]!
  // fallback Paris
  return GLOBE_DEMO_CITIES[0]!
}

export function pickDemoCity(seed: number): GlobeCity {
  const i = Math.abs(seed) % GLOBE_DEMO_CITIES.length
  return GLOBE_DEMO_CITIES[i]!
}
