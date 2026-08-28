/** Shared ProductRequest / ProductQuote DTOs — safe for client. */

export {
  formatProductRequestRelativeTime,
  formatRequestRelativeFr,
} from "@/lib/product-request-i18n"

import { EU_CHECKOUT_EXTRA_ISO2, EU_MEMBER_ISO2 } from "@/lib/eu-market-countries"
import { COUNTRY_TO_SLA } from "@/lib/logistics/delivery-sla"
import { WORLD_RADAR_COUNTRIES, type RadarRegion } from "@/lib/radar/world-countries"

/** Legacy bucket ids — kept for rows created before country-level provenance. */
export const PRODUCT_REQUEST_PROVENANCE_OPTIONS = [
  { id: "any", flag: "🌍" },
  { id: "china", flag: "🇨🇳" },
  { id: "eu", flag: "🇪🇺" },
  { id: "usa", flag: "🇺🇸" },
  { id: "turkey", flag: "🇹🇷" },
  { id: "india", flag: "🇮🇳" },
  { id: "vietnam", flag: "🇻🇳" },
  { id: "local", flag: "📍" },
] as const

export type ProductRequestProvenanceId =
  (typeof PRODUCT_REQUEST_PROVENANCE_OPTIONS)[number]["id"]

const PRODUCT_REQUEST_PROVENANCE_SET = new Set<string>(
  PRODUCT_REQUEST_PROVENANCE_OPTIONS.map((o) => o.id)
)

const LEGACY_PROVENANCE_COUNTRY_MAP: Partial<
  Record<ProductRequestProvenanceId, readonly string[]>
> = {
  china: ["CN"],
  usa: ["US"],
  turkey: ["TR"],
  india: ["IN"],
  vietnam: ["VN"],
}

/** Compliance requirement ids — labels via productRequests.compliance.* i18n keys. */
export const PRODUCT_REQUEST_COMPLIANCE_IDS = [
  "ce_marking",
  "ukca_marking",
  "fcc_compliance",
  "gpsr",
  "reach",
  "rohs",
  "weee",
  "prop65",
  "cpc",
  "iso9001",
  "iso14001",
  "factory_audit",
  "third_party_lab",
  "batch_traceability",
  "aql_inspection",
  "food_grade",
  "msds",
  "bpa_free",
  "oeko_tex",
  "fsc",
  "recyclable_packaging",
  "carbon_neutral",
  "fair_trade",
  "patent_clear",
  "trademark_clear",
] as const

export type ProductRequestComplianceId =
  (typeof PRODUCT_REQUEST_COMPLIANCE_IDS)[number]

const PRODUCT_REQUEST_COMPLIANCE_SET = new Set<string>(PRODUCT_REQUEST_COMPLIANCE_IDS)

export type ProductRequestComplianceGroup = {
  id: string
  ids: readonly ProductRequestComplianceId[]
}

export const PRODUCT_REQUEST_COMPLIANCE_GROUPS: ProductRequestComplianceGroup[] = [
  {
    id: "legal",
    ids: [
      "ce_marking",
      "ukca_marking",
      "fcc_compliance",
      "gpsr",
      "reach",
      "rohs",
      "weee",
      "prop65",
      "cpc",
    ],
  },
  {
    id: "quality",
    ids: [
      "iso9001",
      "iso14001",
      "factory_audit",
      "third_party_lab",
      "batch_traceability",
      "aql_inspection",
    ],
  },
  {
    id: "product",
    ids: ["food_grade", "msds", "bpa_free", "oeko_tex", "fsc"],
  },
  {
    id: "sustainability",
    ids: ["recyclable_packaging", "carbon_neutral", "fair_trade"],
  },
  {
    id: "ip",
    ids: ["patent_clear", "trademark_clear"],
  },
]

/** One-click EU bundle when promotion markets include EU members. */
export const PRODUCT_REQUEST_EU_COMPLIANCE_BUNDLE: ProductRequestComplianceId[] = [
  "ce_marking",
  "gpsr",
  "reach",
  "rohs",
  "weee",
]

export function getProductRequestComplianceGroups(): ProductRequestComplianceGroup[] {
  return PRODUCT_REQUEST_COMPLIANCE_GROUPS
}

export function parseProductRequestComplianceRequirements(
  raw: unknown
): ProductRequestComplianceId[] {
  if (!Array.isArray(raw)) return []
  const parsed = [
    ...new Set(
      raw
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().toLowerCase())
        .filter((id): id is ProductRequestComplianceId =>
          PRODUCT_REQUEST_COMPLIANCE_SET.has(id)
        )
    ),
  ]
  return parsed
}

export function parseProductRequestProvenance(raw: unknown): ProductRequestProvenanceId {
  const id = typeof raw === "string" ? raw.trim().toLowerCase() : "any"
  if (PRODUCT_REQUEST_PROVENANCE_SET.has(id)) {
    return id as ProductRequestProvenanceId
  }
  return "any"
}

export function productRequestProvenanceChipLabel(id: ProductRequestProvenanceId): string {
  const row = PRODUCT_REQUEST_PROVENANCE_OPTIONS.find((o) => o.id === id)
  return row ? `${row.flag}` : "🌍"
}

/** Short FR label for supplier push notifications (server-only copy). */
export const PRODUCT_REQUEST_PROVENANCE_NOTIF_FR: Record<ProductRequestProvenanceId, string> = {
  any: "origine flexible",
  china: "Chine",
  eu: "UE",
  usa: "USA",
  turkey: "Turquie",
  india: "Inde",
  vietnam: "Vietnam",
  local: "local",
}

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
  /** Preferred manufacturing / sourcing origin (legacy bucket). */
  sourceProvenance: ProductRequestProvenanceId
  /** ISO2 manufacturing origins — empty = flexible / any origin. */
  provenanceCountries: string[]
  /** Legal, quality & compliance requirements selected by reseller. */
  complianceRequirements: ProductRequestComplianceId[]
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

/** Category ids — labels via productRequests.categories.* i18n keys. */
export const PRODUCT_REQUEST_CATEGORIES = [
  { id: "baby" },
  { id: "auto" },
  { id: "fitness" },
  { id: "beauty" },
  { id: "tech" },
  { id: "home" },
  { id: "fashion" },
  { id: "general" },
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

export type ProductRequestCountryGroup = {
  /** Region id — label via productRequests.regions.* i18n keys. */
  id: string
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
      groups.push({ id: region, codes })
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
        codes: sortProductRequestCountries(europeUnassigned),
      })
    }
  }

  if (restUnassigned.length > 0) {
    groups.push({
      id: "other",
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

/** Parse provenance ISO2 list — empty array = any origin (valid). */
export function parseProductRequestProvenanceCountries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const parsed = [
    ...new Set(
      raw
        .filter((c): c is string => typeof c === "string")
        .map((c) => normalizeProductRequestCountryCode(c))
        .filter((c) => c.length === 2 && PRODUCT_REQUEST_COUNTRY_SET.has(c))
    ),
  ]
  return sortProductRequestCountries(parsed)
}

export function resolveProductRequestProvenanceCountries(row: {
  provenanceCountries?: string[] | null
  sourceProvenance?: string | null
}): string[] {
  if (Array.isArray(row.provenanceCountries) && row.provenanceCountries.length > 0) {
    return parseProductRequestProvenanceCountries(row.provenanceCountries)
  }
  const legacy = parseProductRequestProvenance(row.sourceProvenance)
  if (legacy === "eu") {
    return sortProductRequestCountries([...EU_MEMBER_ISO2, ...EU_CHECKOUT_EXTRA_ISO2])
  }
  const mapped = LEGACY_PROVENANCE_COUNTRY_MAP[legacy]
  return mapped ? sortProductRequestCountries([...mapped]) : []
}

export function formatProductRequestProvenanceCountries(countries: readonly string[]): string {
  if (countries.length === 0) return ""
  return countries.join(", ")
}

export function productRequestHasFlexibleProvenance(row: {
  provenanceCountries?: string[] | null
  sourceProvenance?: string | null
}): boolean {
  const countries = resolveProductRequestProvenanceCountries(row)
  if (countries.length > 0) return false
  const legacy = parseProductRequestProvenance(row.sourceProvenance)
  return legacy === "any" || legacy === "local"
}

export function provenanceNotifLabelFr(row: {
  provenanceCountries?: string[] | null
  sourceProvenance?: string | null
}): string {
  const countries = resolveProductRequestProvenanceCountries(row)
  if (countries.length === 0) {
    return PRODUCT_REQUEST_PROVENANCE_NOTIF_FR[parseProductRequestProvenance(row.sourceProvenance)]
  }
  if (countries.length <= 4) return countries.join(", ")
  return `${countries.length} origines (${countries.slice(0, 3).join(", ")}…)`
}

export function productRequestProvenanceDisplay(
  row: {
    provenanceCountries?: string[] | null
    sourceProvenance?: string | null
  },
  tProv: (key: string) => string
): string {
  const codes = resolveProductRequestProvenanceCountries(row)
  if (codes.length > 0) {
    if (codes.length <= 3) {
      return codes.map((code) => productRequestCountryChipLabel(code)).join(" · ")
    }
    const head = codes
      .slice(0, 2)
      .map((code) => productRequestCountryChipLabel(code))
      .join(" · ")
    return `${head} +${codes.length - 2}`
  }
  if (productRequestHasFlexibleProvenance(row)) return tProv("any")
  const legacy = parseProductRequestProvenance(row.sourceProvenance)
  const option = PRODUCT_REQUEST_PROVENANCE_OPTIONS.find((o) => o.id === legacy)
  return option ? `${option.flag} ${tProv(legacy)}` : tProv("any")
}

export function formatProductRequestCountries(countries: readonly string[]): string {
  return countries.join(", ")
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
  sourceProvenance?: string | null
  provenanceCountries?: string[] | null
  complianceRequirements?: string[] | null
  createdAt: Date
}): ProductRequestDto {
  const countries = resolveProductRequestCountries(row)
  const provenanceCountries = resolveProductRequestProvenanceCountries(row)
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
    sourceProvenance: parseProductRequestProvenance(row.sourceProvenance),
    provenanceCountries,
    complianceRequirements: parseProductRequestComplianceRequirements(
      row.complianceRequirements
    ),
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
