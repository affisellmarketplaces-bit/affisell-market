import { describe, expect, it } from "vitest"
import {
  canApplyReviewDecision,
  importReviewStateAfterImport,
  importReviewStateFromTags,
  mayListOnProduct,
  withImportReviewState,
} from "@/lib/reseller-import/review"

describe("reseller import review — import, validation and publication are separate", () => {
  it("reads and writes exactly one review state", () => {
    expect(importReviewStateFromTags(["reseller-import"])).toBeNull()
    const tags = withImportReviewState(["reseller-import", "import-review:pending"], "approved")
    expect(tags).toEqual(["reseller-import", "import-review:approved"])
    expect(importReviewStateFromTags(tags)).toBe("approved")
    expect(importReviewStateFromTags(["import-review:bogus"])).toBeNull()
  })

  it("a new import is pending; a re-import never changes an existing decision", () => {
    expect(importReviewStateAfterImport(null)).toBe("pending")
    expect(importReviewStateAfterImport("approved")).toBe("approved")
    expect(importReviewStateAfterImport("rejected")).toBe("rejected")
  })

  it("transitions", () => {
    expect(canApplyReviewDecision("pending", "approve")).toBe(true)
    expect(canApplyReviewDecision("pending", "reject")).toBe(true)
    expect(canApplyReviewDecision("rejected", "approve")).toBe(true)
    expect(canApplyReviewDecision("approved", "reject")).toBe(true)
    expect(canApplyReviewDecision("approved", "approve")).toBe(false)
    expect(canApplyReviewDecision("rejected", "reject")).toBe(false)
    expect(canApplyReviewDecision(null, "approve")).toBe(false)
  })

  it("a listing is listable only on a published, on-sale, approved (or never-imported) product", () => {
    expect(mayListOnProduct({ active: true, isDraft: false, tags: [] })).toBe(true)
    expect(mayListOnProduct({ active: true, isDraft: false, tags: ["import-review:approved"] })).toBe(true)
    expect(mayListOnProduct({ active: true, isDraft: false, tags: ["import-review:pending"] })).toBe(false)
    expect(mayListOnProduct({ active: false, isDraft: true, tags: ["import-review:approved"] })).toBe(false)
    expect(mayListOnProduct({ active: false, isDraft: false, tags: [] })).toBe(false)
  })
})

describe("a reseller can not list an unreviewed product by hand", () => {
  it("the listing PATCH route checks mayListOnProduct before listing", async () => {
    const { readFileSync } = await import("node:fs")
    const path = await import("node:path")
    const src = readFileSync(path.resolve(__dirname, "../../app/api/affiliate/listings/[id]/route.ts"), "utf8")
    expect(src).toContain("mayListOnProduct(row.product)")
    expect(src).toContain("product_not_reviewed")
  })
})
