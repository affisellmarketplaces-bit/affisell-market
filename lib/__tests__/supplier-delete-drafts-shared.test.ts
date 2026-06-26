import { describe, expect, it } from "vitest"

import {
  normalizeSupplierBulkDeleteDraftIds,
  SUPPLIER_BULK_DELETE_DRAFTS_MAX,
} from "@/lib/supplier-delete-drafts-shared"

describe("normalizeSupplierBulkDeleteDraftIds", () => {
  it("dedupes and trims ids", () => {
    expect(normalizeSupplierBulkDeleteDraftIds([" a ", "a", "b", ""])).toEqual(["a", "b"])
  })

  it("caps batch size", () => {
    const ids = Array.from({ length: SUPPLIER_BULK_DELETE_DRAFTS_MAX + 5 }, (_, i) => `id-${i}`)
    expect(normalizeSupplierBulkDeleteDraftIds(ids)).toHaveLength(SUPPLIER_BULK_DELETE_DRAFTS_MAX)
  })

  it("returns empty for non-array", () => {
    expect(normalizeSupplierBulkDeleteDraftIds(null)).toEqual([])
  })
})
