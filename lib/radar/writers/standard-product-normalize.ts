/**
 * Pure normalization helpers for StandardProduct / GMC (no DB).
 */

const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  USA: "USD",
  GB: "GBP",
  UK: "GBP",
  FR: "EUR",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  PT: "EUR",
  IE: "EUR",
  AT: "EUR",
  MX: "MXN",
  BR: "BRL",
  CA: "CAD",
  AU: "AUD",
  JP: "JPY",
  IN: "INR",
  SG: "SGD",
  AE: "AED",
  SA: "SAR",
  PL: "PLN",
  SE: "SEK",
  CH: "CHF",
  TR: "TRY",
  KR: "KRW",
  CN: "CNY",
}

export type SnapshotNormalizeInput = {
  title: string
  price: number | string | { toString(): string } | null | undefined
  currency?: string | null
  imageUrl?: string | null
  /** Extra image candidates (fallback). */
  images?: Array<string | null | undefined>
  brand?: string | null
  marketplaceId: string
  country: string
  externalId: string
  url?: string | null
}

export type NormalizedStandardProduct = {
  marketplaceId: string
  externalId: string
  country: string
  title: string
  description: string
  brand: string
  price: number
  currency: string
  imageUrl: string
  link: string
  availability: "in_stock" | "out_of_stock"
  condition: "new"
  /** GMC mpn/gtin — uses marketplace external id */
  mpn: string
  gtin: string
}

export function toTitleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Max 150 chars, trim, Title Case. */
export function normalizeTitle(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim()
  const sliced = trimmed.slice(0, 150)
  return toTitleCase(sliced)
}

/** Uppercase first letter; fallback Generic. */
export function normalizeBrand(raw: string | null | undefined): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!t) return "Generic"
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function currencyForCountry(country: string): string {
  const cc = country.trim().toUpperCase()
  return COUNTRY_CURRENCY[cc] ?? "USD"
}

export function normalizeCurrency(
  currency: string | null | undefined,
  country: string
): string {
  const c = (currency ?? "").trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(c)) return c
  return currencyForCountry(country)
}

export function parsePrice(value: number | string | { toString(): string } | null | undefined): number {
  if (value == null) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const n = Number.parseFloat(String(value).replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function normalizeHttpsUrl(url: string | null | undefined): string | null {
  const u = (url ?? "").trim()
  if (!u) return null
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
    if (parsed.protocol === "http:") parsed.protocol = "https:"
    return parsed.toString()
  } catch {
    return null
  }
}

export function pickImageUrl(
  primary: string | null | undefined,
  fallbacks: Array<string | null | undefined> = []
): string {
  const candidates = [primary, ...fallbacks]
  for (const c of candidates) {
    const ok = normalizeHttpsUrl(c)
    if (ok) return ok
  }
  return ""
}

export function buildDescription(
  title: string,
  marketplaceId: string,
  country: string
): string {
  const base = `${title} — ${marketplaceId} · ${country.toUpperCase()}`
  return base.slice(0, 500)
}

/**
 * Normalize a RadarGlobalSnapshot-like row into GMC-ready StandardProduct fields.
 */
export function normalizeFromSnapshot(input: SnapshotNormalizeInput): NormalizedStandardProduct | null {
  const marketplaceId = input.marketplaceId.trim()
  const externalId = input.externalId.trim()
  const country = input.country.trim().toUpperCase() || "US"
  if (!marketplaceId || !externalId) return null

  const title = normalizeTitle(input.title || externalId)
  const price = parsePrice(input.price)
  const currency = normalizeCurrency(input.currency, country)
  const brand = normalizeBrand(input.brand)
  const imageUrl = pickImageUrl(input.imageUrl, input.images)
  const link = normalizeHttpsUrl(input.url) ?? ""
  const availability = price > 0 ? "in_stock" : "out_of_stock"

  return {
    marketplaceId,
    externalId,
    country,
    title,
    description: buildDescription(input.title || title, marketplaceId, country),
    brand,
    price,
    currency,
    imageUrl,
    link,
    availability,
    condition: "new",
    mpn: externalId,
    gtin: externalId,
  }
}
