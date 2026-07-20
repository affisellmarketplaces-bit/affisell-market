import { headers } from "next/headers"

export const RADAR_DEFAULT_COUNTRY = "FR" as const

/** Effective radar country — absent param defaults to FR (never US). */
export function resolveRadarDashboardCountry(countryParam: string | undefined | null): string {
  const trimmed = countryParam?.trim().toUpperCase()
  if (trimmed && trimmed.length === 2) return trimmed
  return RADAR_DEFAULT_COUNTRY
}

/**
 * Prefer FR when Accept-Language is French; still defaults to FR for everyone.
 * (Explicit ?country= wins via resolveRadarDashboardCountry.)
 */
export async function inferRadarCountryPreference(): Promise<string> {
  try {
    const h = await headers()
    const raw = h.get("accept-language")?.split(",")[0]?.trim().toLowerCase() ?? ""
    if (raw.startsWith("fr")) return "FR"
  } catch {
    /* static build */
  }
  return RADAR_DEFAULT_COUNTRY
}
