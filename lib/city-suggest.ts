import "server-only"

/**
 * City-name suggestions for the buyer-facing "Ship to" panel.
 *
 * Default provider: Photon (komoot's free OpenStreetMap geocoder, purpose-built for typeahead,
 * no API key: https://photon.komoot.io). Nominatim's own /search endpoint was tried first but is
 * a general geocoder, not an autocomplete: partial queries like "Ber" matched arbitrary
 * hamlets/POIs whose name merely contained the substring (e.g. a farmstead called "Le Par de la"
 * for query "Par") instead of real prefix-relevant cities. Photon with `layer=city` returns
 * properly-ranked inhabited places (Berlin, Bern, Bergamo for "Ber" — confirmed live).
 * `layer=other` is added alongside it because Photon files postal codes under "other", not
 * "city": without it, a buyer typing their postcode (e.g. French "13003") got zero suggestions;
 * with it, that postcode resolves via `properties.city` = "Marseille" — confirmed live.
 *
 * Optional upgrade: when GOOGLE_PLACES_API_KEY is set, suggestions come from Google's Places API
 * (New) Autocomplete instead — better postcode/typo handling and broader coverage, at Google's
 * per-request price. No session token is used here (we never call Place Details afterwards), so
 * this bills as standalone Autocomplete requests rather than the cheaper session-bundled rate —
 * check Google's current Places API pricing before enabling in production. Per Google's Places
 * API terms, Autocomplete predictions must not be cached, so the Google path skips the in-memory
 * cache the Photon path uses.
 *
 * This is a browsing/personalization convenience only (same boundary as the ships-to country
 * cookie, see ships-to-preference.ts): the chosen city is never used to filter products (no
 * city-level shipping field exists on Product) and never touches checkout/payment eligibility.
 */

export type CitySuggestion = {
  label: string
  city: string
  region: string | null
  countryCode: string
  lat: number | null
  lon: number | null
}

const FETCH_TIMEOUT_MS = 5_000
const RESULT_CACHE_TTL_MS = 10 * 60 * 1000 // 10min — city lists don't change; just avoids re-hitting Photon
const PHOTON_USER_AGENT = "Affisell/1.0 (+https://affisell.com; contact: support@affisell.com)"
const GOOGLE_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"

// Photon only accepts these three `lang` values (verified live: es/it/nl/pl/zh all 400).
// Everything else falls back to English names — still real, correct city names, just not
// translated into the buyer's own language.
const PHOTON_LANGS = new Set(["en", "de", "fr"])

type PhotonFeature = {
  properties?: {
    osm_value?: string
    name?: string
    city?: string
    district?: string
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

type GooglePrediction = {
  placePrediction?: {
    text?: { text?: string }
    structuredFormat?: {
      mainText?: { text?: string }
      secondaryText?: { text?: string }
    }
  }
}

type GoogleAutocompleteResponse = {
  suggestions?: GooglePrediction[]
}

const resultCache = new Map<string, { suggestions: CitySuggestion[]; fetchedAt: number }>()

function photonLang(locale: string): string {
  const base = locale.slice(0, 2).toLowerCase()
  return PHOTON_LANGS.has(base) ? base : "en"
}

function cacheKey(provider: string, query: string, countryCode: string | null, locale: string): string {
  return `${provider}|${locale}|${countryCode ?? ""}|${query.toLowerCase()}`
}

/** Public for tests — Photon's raw shape into our de-duplicated suggestion list, optionally scoped to a country. */
export function shapeCitySuggestions(features: PhotonFeature[], countryCode: string | null): CitySuggestion[] {
  const seen = new Set<string>()
  const all: CitySuggestion[] = []

  for (const f of features) {
    const props = f.properties
    const coords = f.geometry?.coordinates
    if (!props || !coords) continue

    const [lon, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    // Postcode entries live under osm_value "postcode": `name` holds the digits, the real city
    // name is `city` (fall back to `district` — some countries only tag that).
    const isPostcode = props.osm_value === "postcode"
    const city = isPostcode ? props.city || props.district : props.name
    if (!city || !props.countrycode) continue

    const code = props.countrycode.toUpperCase()
    const region = props.state ?? null
    const key = `${city.toLowerCase()}|${code}|${region?.toLowerCase() ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)

    const namePart = isPostcode ? `${city} (${props.name})` : city
    const label = region ? `${namePart}, ${region}` : namePart
    all.push({ label, city, region, countryCode: code, lat, lon })
  }

  if (!countryCode) return all
  const scoped = all.filter((s) => s.countryCode === countryCode)
  // Fall back to the unscoped list rather than showing nothing when the buyer's query doesn't
  // happen to match a city in their chosen ship-to country.
  return scoped.length > 0 ? scoped : all
}

/** Public for tests — Google's raw prediction shape into our suggestion list. No coordinates: getting
 *  them would need a separate, billed Place Details call this feature doesn't need. */
export function shapeGoogleCitySuggestions(predictions: GooglePrediction[], countryCode: string | null): CitySuggestion[] {
  const seen = new Set<string>()
  const out: CitySuggestion[] = []

  for (const p of predictions) {
    const pred = p.placePrediction
    const city = pred?.structuredFormat?.mainText?.text
    const label = pred?.text?.text
    if (!city || !label) continue

    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const region = pred?.structuredFormat?.secondaryText?.text ?? null
    out.push({ label, city, region, countryCode: countryCode ?? "", lat: null, lon: null })
  }

  return out.slice(0, 6)
}

async function fetchPhoton(query: string, countryCode: string | null, locale: string): Promise<CitySuggestion[]> {
  const url = new URL("https://photon.komoot.io/api/")
  url.searchParams.set("q", query)
  url.searchParams.set("limit", "8")
  url.searchParams.set("lang", photonLang(locale))
  url.searchParams.set("layer", "city")
  url.searchParams.append("layer", "other")

  const res = await fetch(url, {
    headers: { "User-Agent": PHOTON_USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) return []

  const data = (await res.json()) as PhotonResponse
  return shapeCitySuggestions(data.features ?? [], countryCode).slice(0, 6)
}

async function fetchGoogle(
  query: string,
  countryCode: string | null,
  locale: string,
  apiKey: string
): Promise<CitySuggestion[]> {
  const body: Record<string, unknown> = {
    input: query,
    includedPrimaryTypes: ["locality", "postal_code"],
    languageCode: locale.slice(0, 2).toLowerCase(),
  }
  if (countryCode) body.includedRegionCodes = [countryCode.toLowerCase()]

  const res = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) return []

  const data = (await res.json()) as GoogleAutocompleteResponse
  return shapeGoogleCitySuggestions(data.suggestions ?? [], countryCode)
}

/**
 * @param query Free-text city query (already trimmed, 2+ chars — caller validates).
 * @param countryCode Optional ISO-3166 alpha-2 to prioritize (matches the ships-to country).
 * @param locale Best-effort localized names — mapped to each provider's supported languages.
 */
export async function fetchCitySuggestions(
  query: string,
  countryCode: string | null,
  locale: string
): Promise<CitySuggestion[]> {
  const googleKey = process.env.GOOGLE_PLACES_API_KEY?.trim()
  const provider = googleKey ? "google" : "photon"
  const key = cacheKey(provider, query, countryCode, locale)
  const now = Date.now()

  if (provider === "photon") {
    const cached = resultCache.get(key)
    if (cached && now - cached.fetchedAt < RESULT_CACHE_TTL_MS) return cached.suggestions
  }

  try {
    const suggestions = googleKey
      ? await fetchGoogle(query, countryCode, locale, googleKey)
      : await fetchPhoton(query, countryCode, locale)

    if (provider === "photon") resultCache.set(key, { suggestions, fetchedAt: now })
    return suggestions
  } catch {
    return provider === "photon" ? (resultCache.get(key)?.suggestions ?? []) : []
  }
}
