/** Shared ProductRequest / ProductQuote DTOs — safe for client. */

import { EU_CHECKOUT_EXTRA_ISO2, EU_MEMBER_ISO2 } from "@/lib/eu-market-countries"
import { COUNTRY_TO_SLA } from "@/lib/logistics/delivery-sla"
import { WORLD_RADAR_COUNTRIES, type RadarRegion } from "@/lib/radar/world-countries"

export type ProductRequestDto = {
  id: string
  resellerId: string
  resellerEmail: string
  title: string
  description: string | null
  category: string
  quantity: number
  targetPrice: number | null
  /** Primary market (countries[0]) — legacy single-country field. */
  country: string
  countries: string[]
  imageUrl: string | null
  status: string
  quotesCount: number
  deliverySLA: number | null
  deliveryPriority: string
  createdAt: string
  myQuoteStatus?: string | null
  /** Supplier list: can meet reseller SLA with typical stock ETA */
  slaCompatible?: boolean
}

export type ProductQuoteDto = {
  id: string
  requestId: string
  supplierId: string
  supplierName: string | null
  supplierEmail: string | null
  price: number
  moq: number
  deliveryDays: number
  message: string | null
  status: string
  createdAt: string
}

export const PRODUCT_REQUEST_CATEGORIES = [
  { id: "baby", label: "Bébé" },
  { id: "auto", label: "Auto" },
  { id: "fitness", label: "Fitness" },
  { id: "beauty", label: "Beauté" },
  { id: "tech", label: "Tech" },
  { id: "home", label: "Maison" },
  { id: "fashion", label: "Mode" },
  { id: "general", label: "Général" },
] as const

/** Shopee-native markets not always present in World Radar seed. */
const PRODUCT_REQUEST_SHOPEE_EXTRA = ["MY", "TH", "PH"] as const

const PRODUCT_REQUEST_EU_ONLY = [
  "AT",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "GR",
  "HU",
  "IE",
  "LV",
  "LT",
  "LU",
  "MT",
  "RO",
  "SK",
  "SI",
] as const

function normalizeProductRequestCountryCode(raw: string): string {
  const code = raw.trim().toUpperCase()
  if (code === "UK") return "GB"
  return code.length === 2 ? code : ""
}

function buildProductRequestCountryCodes(): string[] {
  const codes = new Set<string>()
  for (const row of WORLD_RADAR_COUNTRIES) {
    codes.add(normalizeProductRequestCountryCode(row.code))
  }
  for (const code of EU_MEMBER_ISO2) codes.add(code)
  for (const code of EU_CHECKOUT_EXTRA_ISO2) codes.add(code)
  for (const code of Object.keys(COUNTRY_TO_SLA)) {
    const normalized = normalizeProductRequestCountryCode(code)
    if (normalized) codes.add(normalized)
  }
  for (const code of PRODUCT_REQUEST_SHOPEE_EXTRA) codes.add(code)
  for (const code of PRODUCT_REQUEST_EU_ONLY) codes.add(code)
  return [...codes].sort()
}

/** All Affisell markets available for product requests (~50 ISO2). */
export const PRODUCT_REQUEST_COUNTRIES = buildProductRequestCountryCodes() as readonly string[]

const PRODUCT_REQUEST_COUNTRY_SET = new Set<string>(PRODUCT_REQUEST_COUNTRIES)

const RADAR_META_BY_CODE = new Map(
  WORLD_RADAR_COUNTRIES.map((row) => {
    const code = normalizeProductRequestCountryCode(row.code)
    return [code, row] as const
  })
)

const PRODUCT_REQUEST_REGION_ORDER: RadarRegion[] = [
  "Europe",
  "America",
  "Asia",
  "Africa",
  "Oceania",
]

const PRODUCT_REQUEST_REGION_LABELS: Record<RadarRegion, string> = {
  Europe: "Europe",
  America: "Amériques",
  Asia: "Asie",
  Africa: "Afrique & Moyen-Orient",
  Oceania: "Océanie",
}

export type ProductRequestCountryGroup = {
  id: string
  label: string
  codes: readonly string[]
}

/** Region-grouped picker — includes EU-only codes under Europe. */
export function getProductRequestCountryGroups(): ProductRequestCountryGroup[] {
  const assigned = new Set<string>()
  const groups: ProductRequestCountryGroup[] = []

  for (const region of PRODUCT_REQUEST_REGION_ORDER) {
    const codes = PRODUCT_REQUEST_COUNTRIES.filter((code) => {
      const meta = RADAR_META_BY_CODE.get(code)
      return meta?.region === region
    })
    for (const code of codes) assigned.add(code)
    if (codes.length > 0) {
      groups.push({
        id: region,
        label: PRODUCT_REQUEST_REGION_LABELS[region],
        codes,
      })
    }
  }

  const unassigned = PRODUCT_REQUEST_COUNTRIES.filter((code) => !assigned.has(code))
  const europeUnassigned = unassigned.filter(
    (code) =>
      (EU_MEMBER_ISO2 as readonly string[]).includes(code) ||
      (EU_CHECKOUT_EXTRA_ISO2 as readonly string[]).includes(code)
  )
  const restUnassigned = unassigned.filter((code) => !europeUnassigned.includes(code))

  if (europeUnassigned.length > 0) {
    const europeIdx = groups.findIndex((g) => g.id === "Europe")
    if (europeIdx >= 0) {
      const europe = groups[europeIdx]!
      groups[europeIdx] = {
        ...europe,
        codes: sortProductRequestCountries([...europe.codes, ...europeUnassigned]),
      }
    } else {
      groups.unshift({
        id: "Europe",
        label: PRODUCT_REQUEST_REGION_LABELS.Europe,
        codes: sortProductRequestCountries(europeUnassigned),
      })
    }
  }

  if (restUnassigned.length > 0) {
    groups.push({
      id: "other",
      label: "Autres marchés",
      codes: sortProductRequestCountries(restUnassigned),
    })
  }

  return groups
}

export function sortProductRequestCountries(codes: readonly string[]): string[] {
  const index = new Map(PRODUCT_REQUEST_COUNTRIES.map((code, i) => [code, i]))
  return [...codes].sort(
    (a, b) => (index.get(a) ?? 999) - (index.get(b) ?? 999)
  )
}

export function productRequestCountryChipLabel(code: string): string {
  const normalized = normalizeProductRequestCountryCode(code)
  const meta = RADAR_META_BY_CODE.get(normalized)
  return meta ? `${meta.flag} ${normalized}` : normalized
}

/** Parse API body / URL params into validated ISO2 list (≥1). */
export function parseProductRequestCountries(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const parsed = [
      ...new Set(
        raw
          .filter((c): c is string => typeof c === "string")
          .map((c) => normalizeProductRequestCountryCode(c))
          .filter((c) => c.length === 2 && PRODUCT_REQUEST_COUNTRY_SET.has(c))
      ),
    ]
    if (parsed.length > 0) return sortProductRequestCountries(parsed)
  }
  if (typeof raw === "string" && raw.trim()) {
    const fromCsv = raw
      .split(/[,;\s]+/)
      .map((c) => normalizeProductRequestCountryCode(c))
      .filter((c) => c.length === 2 && PRODUCT_REQUEST_COUNTRY_SET.has(c))
    if (fromCsv.length > 0) return sortProductRequestCountries([...new Set(fromCsv)])
  }
  return ["FR"]
}

export function resolveProductRequestCountries(row: {
  countries?: string[] | null
  country?: string | null
}): string[] {
  if (Array.isArray(row.countries) && row.countries.length > 0) {
    return sortProductRequestCountries(
      row.countries.map((c) => normalizeProductRequestCountryCode(c)).filter(Boolean)
    )
  }
  const c = row.country ? normalizeProductRequestCountryCode(row.country) : ""
  return c ? [c] : ["FR"]
}

export function formatProductRequestCountries(countries: readonly string[]): string {
  return countries.join(", ")
}

export function formatRequestRelativeFr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

export function serializeProductRequest(row: {
  id: string
  resellerId: string
  resellerEmail: string
  title: string
  description: string | null
  category: string
  quantity: number
  targetPrice: number | null
  country: string
  countries?: string[] | null
  imageUrl: string | null
  status: string
  quotesCount: number
  deliverySLA: number | null
  deliveryPriority: string
  createdAt: Date
}): ProductRequestDto {
  const countries = resolveProductRequestCountries(row)
  return {
    id: row.id,
    resellerId: row.resellerId,
    resellerEmail: row.resellerEmail,
    title: row.title,
    description: row.description,
    category: row.category,
    quantity: row.quantity,
    targetPrice: row.targetPrice,
    country: countries[0] ?? row.country,
    countries,
    imageUrl: row.imageUrl,
    status: row.status,
    quotesCount: row.quotesCount,
    deliverySLA: row.deliverySLA,
    deliveryPriority: row.deliveryPriority,
    createdAt: row.createdAt.toISOString(),
  }
}

export function serializeProductQuote(row: {
  id: string
  requestId: string
  supplierId: string
  supplierName: string | null
  supplierEmail: string | null
  price: number
  moq: number
  deliveryDays: number
  message: string | null
  status: string
  createdAt: Date
}): ProductQuoteDto {
  return {
    id: row.id,
    requestId: row.requestId,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    supplierEmail: row.supplierEmail,
    price: row.price,
    moq: row.moq,
    deliveryDays: row.deliveryDays,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}
