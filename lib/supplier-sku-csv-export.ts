import type { CustomColumn } from "@/types/product"

import { rowCustomData, type SupplierSkuTableRow } from "@/lib/supplier-sku-builder"

const BASE_HEADERS = [
  "color",
  "size",
  "sku",
  "supplier_price",
  "compare_at",
  "stock",
  "commission_pct",
  "weight_grams",
  "ean",
  "processing_days",
  "warranty_months",
  "origin_country",
  "warehouse_code",
  "video_url",
] as const

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function buildSupplierSkuCsv(
  rows: SupplierSkuTableRow[],
  customColumns: CustomColumn[] = []
): string {
  const customHeaders = customColumns.map((c) => c.key)
  const headers = [...BASE_HEADERS, ...customHeaders]
  const lines = [headers.join(",")]

  for (const row of rows) {
    if (!row.color.trim()) continue
    const data = rowCustomData(row)
    const cells: string[] = [
      row.color,
      row.size ?? "",
      row.sku ?? "",
      String(row.supplierPrice),
      row.compareAtEur != null ? String(row.compareAtEur) : "",
      String(row.stock),
      String(row.commissionRate),
      row.weightGrams != null ? String(row.weightGrams) : "",
      row.ean ?? "",
      row.processingDays != null ? String(row.processingDays) : "",
      row.warrantyMonths != null && row.warrantyMonths > 0 ? String(row.warrantyMonths) : "",
      row.originCountry ?? "",
      row.warehouseCode ?? "",
      row.videoUrl ?? "",
      ...customHeaders.map((key) => {
        const col = customColumns.find((c) => c.key === key)
        const raw = data[key]
        if (raw == null) return ""
        if (col?.type === "boolean") return raw ? "true" : "false"
        return String(raw)
      }),
    ]
    lines.push(cells.map((c) => escapeCsvCell(c)).join(","))
  }

  return lines.join("\n")
}

export function downloadSupplierSkuCsv(
  filename: string,
  rows: SupplierSkuTableRow[],
  customColumns: CustomColumn[] = []
): void {
  const csv = buildSupplierSkuCsv(rows, customColumns)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
