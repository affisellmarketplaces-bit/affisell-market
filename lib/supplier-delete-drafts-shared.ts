export const SUPPLIER_BULK_DELETE_DRAFTS_MAX = 50

export type SupplierBulkDeleteDraftSkipped = {
  id: string
  reason: "not_found" | "not_draft" | "has_orders" | "invalid_id"
}

export type SupplierBulkDeleteDraftsResult = {
  deleted: string[]
  skipped: SupplierBulkDeleteDraftSkipped[]
}

/** Dedupe, trim, cap — safe to replay. */
export function normalizeSupplierBulkDeleteDraftIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== "string") continue
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= SUPPLIER_BULK_DELETE_DRAFTS_MAX) break
  }
  return out
}
