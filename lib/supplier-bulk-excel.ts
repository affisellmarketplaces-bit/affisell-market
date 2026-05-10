import type { ListingKind } from "@/lib/supplier-commission"
import {
  affiliateCommissionMaxPct,
  defaultAffiliateCommissionPct,
  normalizeAffiliateCommissionRatePct,
  parseListingKind,
} from "@/lib/supplier-commission"

export const BULK_SHEET_PRODUCTS = "Products"
export const BULK_SHEET_INSTRUCTIONS = "Instructions"
export const BULK_SHEET_META = "Meta"

export const BULK_MAX_ROWS_PARSE = 150
export const BULK_MAX_ROWS_COMMIT = 40

export type BulkCategoryAttrDef = {
  key: string
  label: string
  type: string
  unit: string | null
  options: string[]
  required: boolean
}

/** Fixed columns (sheet header = key). */
export const BULK_FIXED_COLUMNS: readonly {
  key: string
  description: string
}[] = [
  { key: "name", description: "Product name (required)" },
  { key: "description", description: "Plain text description" },
  { key: "price_usd", description: "Base price in USD, e.g. 29.99 (required)" },
  { key: "compare_at_usd", description: "Optional MSRP / compare-at in USD (must be > price)" },
  { key: "stock", description: "Integer stock (default 0)" },
  { key: "commission_pct", description: `Affiliate commission % (default ${defaultAffiliateCommissionPct()})` },
  { key: "listing_kind", description: "PHYSICAL | SOFTWARE | SUBSCRIPTION (default PHYSICAL)" },
  {
    key: "images",
    description: "Image URLs separated by | or ; (at least one required for publish)",
  },
  { key: "shipping_country", description: "ISO-2 ship-from country, e.g. US" },
  { key: "warehouse_type", description: "local | regional | international (optional)" },
  { key: "processing_time", description: "Processing days (default 1)" },
  { key: "delivery_min", description: "Delivery min days (default 2)" },
  { key: "delivery_max", description: "Delivery max days (default 5)" },
  { key: "shipping_cost_eur", description: "Flat shipping cost EUR (default 0)" },
] as const

export const BULK_ATTR_PREFIX = "attr__"

export function attrColumnKey(attrKey: string): string {
  return `${BULK_ATTR_PREFIX}${attrKey}`
}

function cellToString(val: unknown): string {
  if (val == null) return ""
  if (typeof val === "string") return val.trim()
  if (typeof val === "number" && Number.isFinite(val)) return String(val)
  if (typeof val === "object" && val !== null && "text" in val) {
    const t = (val as { text?: string }).text
    return typeof t === "string" ? t.trim() : ""
  }
  if (typeof val === "object" && val !== null && "richText" in val) {
    const rt = (val as { richText?: { text?: string }[] }).richText
    if (Array.isArray(rt)) return rt.map((x) => x.text ?? "").join("").trim()
  }
  return String(val).trim()
}

export function parseImageUrlsCell(raw: string): string[] {
  const parts = raw.split(/[\n|;\t]+/).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    if (p.startsWith("http") && !seen.has(p)) {
      seen.add(p)
      out.push(p.slice(0, 2000))
    }
    if (out.length >= 12) break
  }
  return out
}

export type ParsedBulkProductRow = {
  name: string
  description: string
  priceUsd: number
  compareAtUsd: number | null
  stock: number
  commissionPct: number
  listingKind: ListingKind
  images: string[]
  shippingBody: Record<string, unknown>
  productAttributes: Array<{ key: string; label: string; value: string }>
}

export type BulkRowParseResult = {
  rowNumber: number
  errors: string[]
  warnings: string[]
  data: ParsedBulkProductRow | null
}

function parseUsdNumber(raw: string, field: string): { ok: true; n: number } | { ok: false; error: string } {
  const t = raw.replace(/\s+/g, "").replace(",", ".")
  if (!t) return { ok: false, error: `${field} is required` }
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `${field} must be a positive number` }
  return { ok: true, n }
}

export function validateAndParseBulkRow(
  rowNumber: number,
  cells: Record<string, string>,
  attrDefs: BulkCategoryAttrDef[]
): BulkRowParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  const name = (cells.name ?? "").trim()
  if (!name) {
    return { rowNumber, errors: ["Missing name"], warnings: [], data: null }
  }

  const desc = (cells.description ?? "").trim()

  const priceR = parseUsdNumber(cells.price_usd ?? "", "price_usd")
  if (!priceR.ok) errors.push(priceR.error)

  let compareAtUsd: number | null = null
  const cmpRaw = (cells.compare_at_usd ?? "").trim()
  if (cmpRaw) {
    const c = Number(cmpRaw.replace(",", "."))
    if (!Number.isFinite(c) || c <= 0) errors.push("compare_at_usd is invalid")
    else compareAtUsd = c
  }

  const stockRaw = (cells.stock ?? "").trim()
  const stock = stockRaw ? Math.max(0, Math.round(Number(stockRaw))) : 0
  if (stockRaw && !Number.isFinite(Number(stockRaw))) errors.push("stock must be a number")

  const listingKind = parseListingKind(cells.listing_kind)

  const commRaw = (cells.commission_pct ?? "").trim()
  const commN = commRaw ? Number(commRaw) : defaultAffiliateCommissionPct()
  if (commRaw && !Number.isFinite(commN)) errors.push("commission_pct invalid")
  const normalizedComm = normalizeAffiliateCommissionRatePct(
    Number.isFinite(commN) ? commN : defaultAffiliateCommissionPct(),
    listingKind
  )
  if (!normalizedComm.ok) errors.push(normalizedComm.error)

  const images = parseImageUrlsCell(cells.images ?? "")
  if (images.length === 0) errors.push("At least one http(s) image URL is required in images")

  let priceUsd = 0
  if (priceR.ok) priceUsd = priceR.n

  if (compareAtUsd != null && priceUsd > 0) {
    if (compareAtUsd <= priceUsd) errors.push("compare_at_usd must be greater than price_usd")
    const discountPct = ((compareAtUsd - priceUsd) / compareAtUsd) * 100
    if (discountPct > 70) errors.push("compare_at discount cannot exceed 70%")
  }

  const shippingBody: Record<string, unknown> = {}
  const cc = (cells.shipping_country ?? "").trim().toUpperCase()
  if (cc.length === 2) shippingBody.shippingCountry = cc
  else if ((cells.shipping_country ?? "").trim()) warnings.push("shipping_country ignored (use ISO-2)")

  const wt = (cells.warehouse_type ?? "").trim().toLowerCase()
  if (wt === "local" || wt === "regional" || wt === "international") shippingBody.warehouseType = wt

  const pt = (cells.processing_time ?? "").trim()
  if (pt) {
    const n = Math.round(Number(pt))
    if (Number.isFinite(n) && n >= 1) shippingBody.processingTime = n
  }
  const dmin = (cells.delivery_min ?? "").trim()
  const dmax = (cells.delivery_max ?? "").trim()
  if (dmin) {
    const n = Math.round(Number(dmin))
    if (Number.isFinite(n)) shippingBody.deliveryMin = n
  }
  if (dmax) {
    const n = Math.round(Number(dmax))
    if (Number.isFinite(n)) shippingBody.deliveryMax = n
  }
  const sc = (cells.shipping_cost_eur ?? "").trim()
  if (sc) {
    const n = Number(sc.replace(",", "."))
    if (Number.isFinite(n) && n >= 0) shippingBody.shippingCostEUR = n
  }

  const productAttributes: Array<{ key: string; label: string; value: string }> = []
  for (const def of attrDefs) {
    const col = attrColumnKey(def.key)
    const raw = (cells[col] ?? "").trim()
    if (!raw) {
      if (def.required) errors.push(`Required characteristic: ${def.label} (${def.key})`)
      continue
    }
    const t = def.type?.toUpperCase() ?? "TEXT"
    if (t === "NUMBER") {
      const n = Number(raw.replace(",", "."))
      if (!Number.isFinite(n)) errors.push(`${def.label}: invalid number`)
    }
    if (t === "SELECT" && def.options.length > 0) {
      const ok = def.options.some((o) => o.toLowerCase() === raw.toLowerCase())
      if (!ok) {
        errors.push(`${def.label}: must be one of: ${def.options.join(", ")}`)
      }
    }
    productAttributes.push({
      key: def.key,
      label: def.label,
      value: raw,
    })
  }

  if (errors.length > 0) {
    return { rowNumber, errors, warnings, data: null }
  }

  const commissionPct = normalizedComm.ok ? normalizedComm.rate : defaultAffiliateCommissionPct()

  return {
    rowNumber,
    errors: [],
    warnings,
    data: {
      name: name.slice(0, 500),
      description: desc.slice(0, 8000) || "—",
      priceUsd,
      compareAtUsd,
      stock,
      commissionPct,
      listingKind,
      images,
      shippingBody,
      productAttributes,
    },
  }
}

/** Read header row (1) into lowercase key → column index. */
export function readHeaderColumnMap(
  getCellValue: (row: number, col: number) => unknown,
  maxCol = 200
): Map<string, number> {
  const map = new Map<string, number>()
  for (let c = 1; c <= maxCol; c++) {
    const key = cellToString(getCellValue(1, c)).toLowerCase()
    if (!key) continue
    map.set(key, c)
  }
  return map
}

export function extractRowCells(
  row: number,
  colMap: Map<string, number>,
  getCellValue: (row: number, col: number) => unknown
): Record<string, string> {
  const cells: Record<string, string> = {}
  for (const [key, col] of colMap) {
    cells[key] = cellToString(getCellValue(row, col))
  }
  return cells
}

export function isRowEmpty(cells: Record<string, string>): boolean {
  const name = (cells.name ?? "").trim()
  const price = (cells.price_usd ?? "").trim()
  const imgs = (cells.images ?? "").trim()
  return !name && !price && !imgs
}

export function errorsToCsv(rows: Array<{ rowNumber: number; errors: string[] }>): string {
  const lines = ["row,errors"]
  for (const r of rows) {
    if (!r.errors.length) continue
    const esc = r.errors.join("; ").replace(/"/g, '""')
    lines.push(`${r.rowNumber},"${esc}"`)
  }
  return lines.join("\n")
}

export function commissionHintForListingKind(kind: ListingKind): string {
  return String(affiliateCommissionMaxPct(kind))
}

export async function buildBulkImportTemplateBuffer(params: {
  categoryId: string
  categoryPath: string
  attrDefs: BulkCategoryAttrDef[]
}): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Affisell"
  wb.created = new Date()

  const meta = wb.addWorksheet(BULK_SHEET_META, { state: "visible" })
  meta.getCell("A1").value = "category_id"
  meta.getCell("B1").value = params.categoryId
  meta.getCell("A2").value = "category_path"
  meta.getCell("B2").value = params.categoryPath
  meta.getCell("A3").value = "generated_at"
  meta.getCell("B3").value = new Date().toISOString()
  meta.columns = [{ width: 18 }, { width: 72 }]

  const guide = wb.addWorksheet(BULK_SHEET_INSTRUCTIONS, { state: "visible" })
  const lines = [
    "Bulk import — how it works",
    "",
    "1. Fill only the «Products» sheet. Row 1 must stay as the header keys (do not rename columns).",
    "2. One row = one product. All rows use the category you selected when downloading this file.",
    "3. images: use full https URLs, separated by | or ; . At least one image per row.",
    "4. Characteristics columns start with attr__ — match required fields for this category.",
    "5. Upload the file on the bulk import page → validate → publish. Invalid rows are skipped or fixed and re-uploaded.",
    "",
    "Tips (innovations):",
    "• Validate first: you get a row-by-row report before anything is created.",
    "• Download errors as CSV from the preview if some rows fail.",
    "• Publish runs in small batches with a live progress bar.",
    "",
    `Category path: ${params.categoryPath}`,
  ]
  lines.forEach((line, i) => {
    guide.getCell(i + 1, 1).value = line
  })
  guide.getColumn(1).width = 92

  const ws = wb.addWorksheet(BULK_SHEET_PRODUCTS, { state: "visible" })
  const headers: string[] = BULK_FIXED_COLUMNS.map((c) => c.key)
  for (const a of params.attrDefs) {
    headers.push(attrColumnKey(a.key))
  }
  ws.addRow(headers)
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: "frozen", ySplit: 1 }]

  const hints = wb.addWorksheet("Column_hints", { state: "visible" })
  hints.addRow(["column", "hint"])
  hints.getRow(1).font = { bold: true }
  for (const c of BULK_FIXED_COLUMNS) {
    hints.addRow([c.key, c.description])
  }
  for (const a of params.attrDefs) {
    const req = a.required ? "required" : "optional"
    const opt =
      a.type?.toUpperCase() === "SELECT" && a.options.length
        ? `Options: ${a.options.join(" | ")}`
        : a.type?.toUpperCase() === "NUMBER"
          ? "Number"
          : "Text"
    hints.addRow([attrColumnKey(a.key), `${a.label} (${req}) — ${opt}${a.unit ? `; unit: ${a.unit}` : ""}`])
  }
  hints.columns = [{ width: 28 }, { width: 80 }]

  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = Math.min(28, Math.max(12, headers[i]!.length + 2))
  })

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

export async function parseBulkImportWorkbookBuffer(
  buffer: ArrayBuffer,
  attrDefs: BulkCategoryAttrDef[]
): Promise<BulkRowParseResult[]> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.getWorksheet(BULK_SHEET_PRODUCTS) ?? wb.worksheets[0]
  if (!ws) return []

  const lastCol = Math.min(200, ws.actualColumnCount || 60)
  const getCellValue = (r: number, c: number) => ws.getCell(r, c).value
  const colMap = readHeaderColumnMap(getCellValue, lastCol)

  const results: BulkRowParseResult[] = []
  let emptyStreak = 0
  for (let r = 2; r <= 2 + BULK_MAX_ROWS_PARSE; r++) {
    const cells = extractRowCells(r, colMap, getCellValue)
    if (isRowEmpty(cells)) {
      emptyStreak++
      if (emptyStreak >= 25 && results.length > 0) break
      continue
    }
    emptyStreak = 0
    results.push(validateAndParseBulkRow(r, cells, attrDefs))
  }
  return results
}
