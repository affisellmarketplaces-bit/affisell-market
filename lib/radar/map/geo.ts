/** Client-safe geo helpers for Radar World Map (no Prisma). */

export const WORLD_GEO_JSON_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

/** Approx ISO2 → [longitude, latitude] centroids for markers. */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  US: [-98.5, 39.8],
  BR: [-51.9, -14.2],
  FR: [2.2, 46.2],
  DE: [10.4, 51.1],
  UK: [-2.5, 54.0],
  GB: [-2.5, 54.0],
  ID: [113.9, -0.8],
  ES: [-3.7, 40.4],
  IT: [12.5, 42.8],
  MX: [-102.5, 23.6],
  CA: [-106.3, 56.1],
  JP: [138.2, 36.2],
  KR: [127.8, 35.9],
  IN: [78.9, 22.0],
  AU: [133.8, -25.3],
  AE: [53.8, 23.4],
  NG: [8.7, 9.1],
  ZA: [25.0, -29.0],
  PL: [19.1, 52.1],
  NL: [5.3, 52.1],
  SE: [18.6, 60.1],
  TR: [35.2, 39.0],
  SA: [45.1, 23.9],
  AR: [-63.6, -38.4],
  CO: [-74.3, 4.6],
  CL: [-71.5, -35.7],
  VN: [108.3, 14.1],
  TH: [100.9, 15.8],
  PH: [121.8, 12.9],
  MY: [101.9, 4.2],
  SG: [103.8, 1.35],
  CN: [104.2, 35.9],
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  BR: "Brazil",
  FR: "France",
  DE: "Germany",
  UK: "United Kingdom",
  GB: "United Kingdom",
  ID: "Indonesia",
  ES: "Spain",
  IT: "Italy",
  MX: "Mexico",
  CA: "Canada",
  JP: "Japan",
  KR: "South Korea",
  IN: "India",
  AU: "Australia",
  AE: "United Arab Emirates",
  NG: "Nigeria",
  ZA: "South Africa",
  PL: "Poland",
  NL: "Netherlands",
  SE: "Sweden",
  TR: "Turkey",
  SA: "Saudi Arabia",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  VN: "Vietnam",
  TH: "Thailand",
  PH: "Philippines",
  MY: "Malaysia",
  SG: "Singapore",
  CN: "China",
}

export function countryCodeToName(code: string): string {
  const c = code.trim().toUpperCase()
  return COUNTRY_NAMES[c] ?? c
}

export function getCountryCoords(code: string): [number, number] | null {
  const c = code.trim().toUpperCase()
  return COUNTRY_COORDS[c] ?? null
}

export type CountryMapStat = {
  country: string
  count: number
  avgSales: number
  topProductTitle: string | null
}

export const MOCK_MAP_STATS: CountryMapStat[] = [
  { country: "US", count: 420, avgSales: 8200, topProductTitle: "LED Strip Lights RGB 5m" },
  { country: "BR", count: 310, avgSales: 12400, topProductTitle: "Shapewear High-Waist" },
  { country: "FR", count: 180, avgSales: 5400, topProductTitle: "MagSafe Phone Case" },
  { country: "DE", count: 150, avgSales: 4900, topProductTitle: "Portable Blender USB-C" },
  { country: "ID", count: 220, avgSales: 9100, topProductTitle: "Neck Massager Heated" },
]

/** Map avg salesEst → heat color (green → amber → red). */
export function salesToHeatColor(avgSales: number, maxAvg: number): string {
  const t = maxAvg > 0 ? Math.min(1, Math.max(0, avgSales / maxAvg)) : 0
  if (t < 0.33) return "#22c55e"
  if (t < 0.66) return "#eab308"
  return "#ef4444"
}

export function markerRadius(count: number, maxCount: number): number {
  const t = maxCount > 0 ? count / maxCount : 0.2
  return 4 + t * 14
}
