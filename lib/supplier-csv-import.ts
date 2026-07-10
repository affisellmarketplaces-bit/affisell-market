import type { ParsedBulkProductRow } from "@/lib/supplier-bulk-excel"
import { defaultAffiliateCommissionPct } from "@/lib/supplier-commission"

/** Canonical CSV columns for supplier onboarding template. */
export const SUPPLIER_CSV_CANONICAL_FIELDS = [
  "title",
  "description",
  "price_eur",
  "stock",
  "image_url",
  "category",
  "shipping_days",
] as const

export type SupplierCsvFieldKey = (typeof SUPPLIER_CSV_CANONICAL_FIELDS)[number]

export type SupplierCsvColumnMapping = Partial<Record<SupplierCsvFieldKey, string>>

export type SupplierCsvRawRow = Record<string, string>

export const SUPPLIER_CSV_MAX_ROWS = 40
export const SUPPLIER_CSV_PREVIEW_COUNT = 5

export const SUPPLIER_CSV_TEMPLATE_HEADER =
  "title,description,price_eur,stock,image_url,category,shipping_days"

export const SUPPLIER_CSV_TEMPLATE_SAMPLE = [
  SUPPLIER_CSV_TEMPLATE_HEADER,
  'T-shirt bio,"Coton bio 180g, coupe unisexe",24.90,120,https://example.com/tshirt.jpg,Mode,5',
  'Casque Bluetooth,"ANC 40h autonomie",89.00,45,https://example.com/headphones.jpg,Électronique,3',
].join("\n")

const FIELD_ALIASES: Record<SupplierCsvFieldKey, string[]> = {
  title: ["title", "name", "product", "produit", "titre", "nom"],
  description: ["description", "desc", "body"],
  price_eur: ["price_eur", "price", "prix", "wholesale", "prix_eur"],
  stock: ["stock", "qty", "quantity", "inventory"],
  image_url: ["image_url", "image", "images", "photo", "img"],
  category: ["category", "categorie", "cat", "type"],
  shipping_days: ["shipping_days", "delivery_days", "shipping", "livraison"],
}

/** Minimal RFC-style CSV parser (quoted fields, commas). */
export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const parsed = lines.map(parseCsvLine)
  const headers = parsed[0]!.map((h) => h.trim())
  const rows = parsed.slice(1).filter((r) => r.some((c) => c.trim()))
  return { headers, rows }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

export function rowsToObjects(headers: string[], rows: string[][]): SupplierCsvRawRow[] {
  return rows.map((cells) => {
    const obj: SupplierCsvRawRow = {}
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim()
    })
    return obj
  })
}

export function suggestSupplierCsvMapping(headers: string[]): SupplierCsvColumnMapping {
  const mapping: SupplierCsvColumnMapping = {}
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim())

  for (const field of SUPPLIER_CSV_CANONICAL_FIELDS) {
    const aliases = FIELD_ALIASES[field]
    const idx = lowerHeaders.findIndex((h) => aliases.includes(h))
    if (idx >= 0) mapping[field] = headers[idx]
  }
  return mapping
}

function cellValue(row: SupplierCsvRawRow, mapping: SupplierCsvColumnMapping, field: SupplierCsvFieldKey): string {
  const header = mapping[field]
  if (!header) return ""
  return (row[header] ?? "").trim()
}

export type MappedSupplierCsvRow = {
  index: number
  title: string
  description: string
  priceEur: number
  stock: number
  imageUrl: string
  categoryName: string
  shippingDays: number
  errors: string[]
}

export function mapSupplierCsvRows(
  rawRows: SupplierCsvRawRow[],
  mapping: SupplierCsvColumnMapping
): MappedSupplierCsvRow[] {
  return rawRows.slice(0, SUPPLIER_CSV_MAX_ROWS).map((row, index) => {
    const errors: string[] = []
    const title = cellValue(row, mapping, "title")
    const description = cellValue(row, mapping, "description") || "—"
    const priceRaw = cellValue(row, mapping, "price_eur").replace(",", ".")
    const priceEur = Number(priceRaw)
    const stock = Math.max(0, Math.round(Number(cellValue(row, mapping, "stock")) || 0))
    const imageUrl = cellValue(row, mapping, "image_url")
    const categoryName = cellValue(row, mapping, "category")
    const shippingDays = Math.max(
      1,
      Math.round(Number(cellValue(row, mapping, "shipping_days")) || 5)
    )

    if (!title) errors.push("missing_title")
    if (!Number.isFinite(priceEur) || priceEur <= 0) errors.push("invalid_price")
    if (!imageUrl.startsWith("http")) errors.push("invalid_image_url")
    if (!categoryName) errors.push("missing_category")

    return {
      index,
      title,
      description,
      priceEur,
      stock,
      imageUrl,
      categoryName,
      shippingDays,
      errors,
    }
  })
}

export function toBulkProductRow(mapped: MappedSupplierCsvRow): ParsedBulkProductRow {
  const deliveryMin = Math.max(1, mapped.shippingDays - 2)
  return {
    name: mapped.title,
    description: mapped.description,
    priceEur: mapped.priceEur,
    compareAtEur: null,
    stock: mapped.stock,
    commissionPct: defaultAffiliateCommissionPct(),
    listingKind: "PHYSICAL",
    images: [mapped.imageUrl],
    shippingBody: {
      processingTime: 1,
      deliveryMin,
      deliveryMax: mapped.shippingDays,
      shippingCostEUR: 0,
    },
    productAttributes: [],
  }
}

export function mappingIsComplete(mapping: SupplierCsvColumnMapping): boolean {
  return (
    Boolean(mapping.title?.trim()) &&
    Boolean(mapping.price_eur?.trim()) &&
    Boolean(mapping.image_url?.trim()) &&
    Boolean(mapping.category?.trim())
  )
}
