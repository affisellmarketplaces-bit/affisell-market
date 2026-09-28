import "server-only"

/**
 * City-name suggestions for the buyer-facing "Ship to" panel — a real, live autocomplete backed
 * by Photon (komoot's free OpenStreetMap geocoder, purpose-built for typeahead, no API key:
 * https://photon.komoot.io). Nominatim's own /search endpoint was tried first but is a general
 * geocoder, not an autocomplete: partial queries like "Ber" matched arbitrary hamlets/POIs whose
 * name merely contained the substring (e.g. a farmstead called "Le Par de la" for query "Par")
 * instead of real prefix-relevant cities. Photon with `layer=city` returns properly-ranked
 * inhabited places (Berlin, Bern, Bergamo for "Ber") — confirmed by live query before switching.
 *
 * This is a browsing/personalization convenience only (same boundary as the ships-to country
 * cookie, see ships-to-preference.ts): the chosen city is never used to filter products (no
 * city-level shipping field exists on Product) and never touches checkout/payment eligibility.
 *
 * Photon has no official published rate limit but is a shared community service — the per-IP
 * rate limit on the API route plus this short in-memory cache keep usage light and considerate.
 */

const FETCH_TIMEOUT_MS = 5_000
const RESULT_CACHE_TTL_MS = 10 * 60 * 1000 // 10min — city lists don't change; just avoids re-hitting Photon
const PHOTON_USER_AGENT = "Affisell/1.0 (+https://affisell.com; contact: support@affisell.com)"

// Photon only accepts these three `lang` values (verified live: es/it/nl/pl/zh all 400).
// Everything else falls back to English names — still real, correct city names, just not
// translated into the buyer's own language.
const PHOTON_LANGS = new Set(["en", "de", "fr"])

export type CitySuggestion = {
  label: string
  city: string
  region: string | null
  countryCode: string
  lat: number
  lon: number
}

type PhotonFeature = {
  properties?: {
    name?: string
    state?: string
    countrycode?: string
  }
  geometry?: {
    coordinates?: [number, number] // [lon, lat]
  }
}

type PhotonResponse = {
  features?: PhotonFeature[]
}

const resultCache = new Map<string, { suggestions: CitySuggestion[]; fetchedAt: number }>()

function photonLang(locale: string): string {
  const base = locale.slice(0, 2).toLowerCase()
  return PHOTON_LANGS.has(base) ? base : "en"
}

function cacheKey(query: string, countryCode: string | null, lang: string): string {
  return `${lang}|${countryCode ?? ""}|${query.toLowerCase()}`
}

/** Public for tests — Photon's raw shape into our de-duplicated suggestion list, optionally scoped to a country. */
export function shapeCitySuggestions(features: PhotonFeature[], countryCode: string | null): CitySuggestion[] {
  const seen = new Set<string>()
  const all: CitySuggestion[] = []

  for (const f of features) {
    const props = f.properties
    const coords = f.geometry?.coordinates
    if (!props?.name || !props.countrycode || !coords) continue

    const [lon, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const city = props.name
    const code = props.countrycode.toUpperCase()
    const region = props.state ?? null
    const key = `${city.toLowerCase()}|${code}|${region?.toLowerCase() ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)

    all.push({ label: region ? `${city}, ${region}` : city, city, region, countryCode: code, lat, lon })
  }

  if (!countryCode) return all
  const scoped = all.filter((s) => s.countryCode === countryCode)
  // Fall back to the unscoped list rather than showing nothing when the buyer's query doesn't
  // happen to match a city in their chosen ship-to country.
  return scoped.length > 0 ? scoped : all
}

/**
 * @param query Free-text city query (already trimmed, 2+ chars — caller validates).
 * @param countryCode Optional ISO-3166 alpha-2 to prioritize (matches the ships-to country).
 * @param locale Best-effort localized names — mapped to Photon's supported en/de/fr, else English.
 */
export async function fetchCitySuggestions(
  query: string,
  countryCode: string | null,
  locale: string
): Promise<CitySuggestion[]> {
  const lang = photonLang(locale)
  const key = cacheKey(query, countryCode, lang)
  const cached = resultCache.get(key)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < RESULT_CACHE_TTL_MS) {
    return cached.suggestions
  }

  const url = new URL("https://photon.komoot.io/api/")
  url.searchParams.set("q", query)
  url.searchParams.set("limit", "8")
  url.searchParams.set("lang", lang)
  url.searchParams.set("layer", "city")

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": PHOTON_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return cached?.suggestions ?? []

    const data = (await res.json()) as PhotonResponse
    const suggestions = shapeCitySuggestions(data.features ?? [], countryCode).slice(0, 6)
    resultCache.set(key, { suggestions, fetchedAt: now })
    return suggestions
  } catch {
    return cached?.suggestions ?? []
  }
}
