import type { SupplierSimpleColorRow } from "@/lib/supplier-add-product-draft-cache"
import { newVariantRowId, type ProductVariantLine } from "@/lib/product-variants"

/** Marketplace default when the source brand is unknown or untrusted. */
export const GENERIC_BRAND_LABEL = "Generic"

const KNOWN_BRANDS = [
  "Apple",
  "Samsung",
  "Google",
  "Xiaomi",
  "OnePlus",
  "Huawei",
  "Sony",
  "LG",
  "Nike",
  "Adidas",
  "Puma",
  "Microsoft",
  "Dell",
  "HP",
  "Lenovo",
  "Asus",
  "Acer",
  "Canon",
  "Nikon",
  "Bose",
  "JBL",
  "Philips",
  "Dyson",
  "Fitbit",
  "Garmin",
  "Amazfit",
  "Anker",
  "Logitech",
  "Razer",
  "PlayStation",
  "Nintendo",
] as const

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = parseFloat(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

/** Normalize scraped brand + title into a catalog brand or Generic. */
export function normalizeImportBrand(scrapedBrand: string, title: string): string {
  const raw = scrapedBrand.trim()
  const lowerTitle = title.toLowerCase()

  for (const known of KNOWN_BRANDS) {
    if (lowerTitle.includes(known.toLowerCase())) return known
    if (raw.toLowerCase() === known.toLowerCase()) return known
  }

  if (/^xiaomi\b/i.test(lowerTitle) || /\bmi\s+band/i.test(lowerTitle)) return "Xiaomi"
  if (/\biphone\b/i.test(lowerTitle) || /\bipad\b/i.test(lowerTitle)) return "Apple"
  if (/\bgalaxy\b/i.test(lowerTitle) && /\bsamsung\b/i.test(lowerTitle)) return "Samsung"

  const cleaned = raw
    .replace(/^(visit the|brand:|marque:)\s*/i, "")
    .replace(/\s+store$/i, "")
    .trim()

  if (!cleaned || cleaned.length < 2) return GENERIC_BRAND_LABEL
  if (/aliexpress|temu|shein|amazon|official store|boutique/i.test(cleaned)) return GENERIC_BRAND_LABEL
  if (cleaned.length > 48) return GENERIC_BRAND_LABEL

  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

export type ImportedVariantRow = {
  name: string
  type: string
  image: string
  price: number
  stock: number
  sku: string
  attributes: Record<string, string>
}

export type ImportedColorRow = { name: string; image: string; hex: string }
export type ImportedSizeRow = { name: string; value: string }

export type UrlImportScrapedProduct = {
  title?: unknown
  description?: unknown
  ai_description?: unknown
  price?: unknown
  original_price?: unknown
  suggested_price?: unknown
  basePrice?: unknown
  stock?: unknown
  images?: unknown
  videos?: unknown
  brand?: unknown
  specs?: unknown
  shipping?: unknown
  variants?: unknown
  colors?: unknown
  sizes?: unknown
}

export type UrlImportVariantApply = {
  mode: "none" | "simple" | "advanced"
  sizes: string[]
  simpleColors: SupplierSimpleColorRow[]
  variantRows: ProductVariantLine[]
}

export function mapImportedVariants(
  p: UrlImportScrapedProduct,
  listingPriceEur: number,
  commissionPct: string
): UrlImportVariantApply {
  const commission = Math.min(50, Math.max(1, Math.round(Number(commissionPct)) || 20))
  const priceCents = Math.max(0, Math.round(listingPriceEur * 100))

  const variants: ImportedVariantRow[] = Array.isArray(p.variants)
    ? p.variants
        .map((v) => {
          const r = asRec(v)
          return {
            name: txt(r.name),
            type: txt(r.type),
            image: txt(r.image),
            price: num(r.price),
            stock: Math.max(0, Math.round(num(r.stock))),
            sku: txt(r.sku),
            attributes: asRec(r.attributes) as Record<string, string>,
          }
        })
        .filter((v) => v.name)
    : []

  const colors: ImportedColorRow[] = Array.isArray(p.colors)
    ? p.colors
        .map((c) => {
          const r = asRec(c)
          return {
            name: txt(r.name),
            image: txt(r.image),
            hex: txt(r.hex) || "#CCCCCC",
          }
        })
        .filter((c) => c.name)
    : []

  const sizes: string[] = []
  if (Array.isArray(p.sizes)) {
    for (const s of p.sizes) {
      const r = asRec(s)
      const n = txt(r.name) || txt(r.value) || (typeof s === "string" ? s : "")
      if (n && !sizes.includes(n)) sizes.push(n)
    }
  }

  const shopifyStyleRows = variants.filter(
    (v) => v.sku && (v.price > 0 || v.stock > 0) && v.type === "Variant"
  )
  if (shopifyStyleRows.length >= 2) {
    return {
      mode: "advanced",
      sizes: [],
      simpleColors: [],
      variantRows: shopifyStyleRows.map((v) => ({
        id: newVariantRowId(),
        name: v.name,
        sku: v.sku,
        priceCents: v.price > 0 ? Math.round(v.price * 100) : priceCents,
        stock: v.stock,
        commission,
        sales: 0,
        image: v.image || undefined,
      })),
    }
  }

  for (const v of variants) {
    const t = v.type.toLowerCase()
    if (t.includes("size") || t.includes("taille")) {
      if (!sizes.includes(v.name)) sizes.push(v.name)
    }
  }

  const colorRows: SupplierSimpleColorRow[] =
    colors.length > 0
      ? colors.map((c) => ({
          id: newVariantRowId(),
          name: c.name,
          image: c.image,
        }))
      : variants
          .filter((v) => v.type.toLowerCase().includes("color") || v.type.toLowerCase().includes("couleur"))
          .map((v) => ({
            id: newVariantRowId(),
            name: v.name,
            image: v.image,
          }))

  if (sizes.length > 0 || colorRows.length > 0) {
    return {
      mode: "simple",
      sizes,
      simpleColors: colorRows.length > 0 ? colorRows : [{ id: newVariantRowId(), name: "", image: "" }],
      variantRows: [],
    }
  }

  return { mode: "none", sizes: [], simpleColors: [], variantRows: [] }
}

export function extractVideoUrls(raw: unknown, max = 3): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const url = typeof item === "string" ? item.trim() : txt(asRec(item).url) || txt(asRec(item).src)
    if (!url || !/^https?:\/\//i.test(url)) continue
    if (!/\.(mp4|webm|m3u8)(\?|$)/i.test(url) && !url.includes("video")) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
    if (out.length >= max) break
  }
  return out
}

export type UrlImportFormPatch = {
  name: string
  description: string
  images: string[]
  illustrationVideos: string[]
  stock: string
  price: string
  compareAt: string
  brand: string
  shippingCountry: string
  warehouseType: "" | "local" | "regional" | "international"
  processingTime: string
  deliveryMin: string
  deliveryMax: string
  shippingCost: string
  specValuesPatch: Record<string, string>
  variants: UrlImportVariantApply
  /** Optional AI-suggested Affisell category leaf id */
  categoryId?: string
  categoryBreadcrumb?: string
}

export function guessIso2Country(label: string): string {
  const l = label.toLowerCase().trim()
  const map: Record<string, string> = {
    china: "CN",
    "hong kong": "HK",
    usa: "US",
    "united states": "US",
    uk: "GB",
    "united kingdom": "GB",
    france: "FR",
    germany: "DE",
    spain: "ES",
    italy: "IT",
    netherlands: "NL",
    belgium: "BE",
    poland: "PL",
    japan: "JP",
    korea: "KR",
    canada: "CA",
    australia: "AU",
  }
  for (const [word, cc] of Object.entries(map)) {
    if (l.includes(word)) return cc
  }
  if (/^[a-z]{2}$/i.test(label.trim())) return label.trim().toUpperCase()
  return ""
}

export function parseDeliveryRange(s: string): { min: string; max: string } {
  const t = s.replace(/–/g, "-")
  const m = t.match(/(\d+)\s*-\s*(\d+)/)
  if (m) return { min: m[1] ?? "2", max: m[2] ?? "5" }
  const one = t.match(/(\d+)/)
  return one ? { min: one[1]!, max: one[1]! } : { min: "2", max: "5" }
}

export function mergeSpecsFromImport(
  defs: Array<{ key: string; label: string }>,
  specs: Record<string, unknown>,
  brand: string
): Record<string, string> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(specs)) {
    if (typeof v !== "string" || !v.trim()) continue
    flat[norm(k)] = v.trim()
  }

  const out: Record<string, string> = {}
  for (const d of defs) {
    const val = flat[norm(d.key)] ?? flat[norm(d.label)]
    if (val) out[d.key] = val
  }

  if (brand) {
    const brandDef = defs.find((d) => d.key.toLowerCase() === "brand")
    if (brandDef && !out[brandDef.key]) out[brandDef.key] = brand
  }

  return out
}

export function buildUrlImportFormPatch(
  p: UrlImportScrapedProduct,
  options: {
    markup: number
    categoryAttrs: Array<{ key: string; label: string }>
    commissionPct: string
  }
): UrlImportFormPatch {
  const title = txt(p.title)
  const descRaw =
    txt(p.ai_description) || txt(p.description) || "—"
  const images = Array.isArray(p.images)
    ? p.images.filter((x): x is string => typeof x === "string" && /^https?:\/\//i.test(x)).slice(0, 12)
    : []
  const illustrationVideos = extractVideoUrls(p.videos, 2)

  const stockN = Math.max(0, Math.round(num(p.stock)))
  const priceScraped = num(p.price)
  const suggested = num(p.suggested_price) || num(p.basePrice)
  const original = num(p.original_price)
  const mk = options.markup > 0 ? options.markup : 2.5
  const priceUsd =
    suggested > 0 ? suggested : priceScraped > 0 ? Math.round(priceScraped * mk * 100) / 100 : 0

  let compareAt = ""
  if (original > 0 && priceUsd > 0 && original > priceUsd) {
    compareAt = original.toFixed(2)
  }

  const ship = asRec(p.shipping)
  const fromCountry = txt(ship.from_country)
  const cc = guessIso2Country(fromCountry)
  const deliveryTime = txt(ship.delivery_time)
  const { min: dmin, max: dmax } = parseDeliveryRange(deliveryTime)
  const shipCost = num(ship.shipping_cost)
  const fl = fromCountry.toLowerCase()
  const warehouseType: "" | "local" | "regional" | "international" =
    /china|hong kong|aliexpress|temu|shein/i.test(fl) || cc === "CN"
      ? "international"
      : cc === "US" || cc === "GB"
        ? "regional"
        : cc
          ? "regional"
          : ""

  const brand = normalizeImportBrand(txt(p.brand), title)
  const specValuesPatch = mergeSpecsFromImport(
    options.categoryAttrs,
    asRec(p.specs) as Record<string, unknown>,
    brand
  )

  const variants = mapImportedVariants(p, priceUsd, options.commissionPct)

  return {
    name: title.slice(0, 500),
    description: descRaw.slice(0, 8000),
    images,
    illustrationVideos,
    stock: String(stockN || 0),
    price: priceUsd > 0 ? priceUsd.toFixed(2) : "",
    compareAt,
    brand,
    shippingCountry: cc,
    warehouseType,
    processingTime: "1",
    deliveryMin: dmin,
    deliveryMax: dmax,
    shippingCost: Number.isFinite(shipCost) && shipCost >= 0 ? String(shipCost) : "0",
    specValuesPatch,
    variants,
  }
}
