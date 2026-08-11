import { describe, expect, it } from "vitest"

import { resolveSupplierProductDraftLivePatch } from "@/lib/supplier-product-draft-live-patch"

describe("resolveSupplierProductDraftLivePatch", () => {
  it("activates on publish", () => {
    expect(
      resolveSupplierProductDraftLivePatch({
        publish: true,
        saveAsDraft: false,
        currentIsDraft: true,
      })
    ).toEqual({ active: true, isDraft: false })
  })

  it("keeps draft only when saveAsDraft and row is still draft", () => {
    expect(
      resolveSupplierProductDraftLivePatch({
        publish: false,
        saveAsDraft: true,
        currentIsDraft: true,
      })
    ).toEqual({ active: false, isDraft: true })
  })

  it("does not downgrade after publish when stale autosave arrives", () => {
    expect(
      resolveSupplierProductDraftLivePatch({
        publish: false,
        saveAsDraft: true,
        currentIsDraft: false,
      })
    ).toEqual({})
  })

  it("leaves live listing flags untouched on live update", () => {
    expect(
      resolveSupplierProductDraftLivePatch({
        publish: false,
        saveAsDraft: false,
        currentIsDraft: false,
      })
    ).toEqual({})
  })
})
