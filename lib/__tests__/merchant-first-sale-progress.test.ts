import { describe, expect, it } from "vitest"

import {
  buildAffiliateFirstSaleProgress,
  buildSupplierFirstSaleProgress,
} from "@/lib/merchant-first-sale-progress"

describe("merchant first sale progress", () => {
  it("supplier next step is KYC when not approved", () => {
    const progress = buildSupplierFirstSaleProgress({
      kycApproved: false,
      draftCount: 1,
      publishedCount: 0,
      storeSlug: "acme",
    })
    expect(progress.nextStepId).toBe("kyc")
    expect(progress.showChecklist).toBe(true)
    expect(progress.postKycHref).toBe("/dashboard/supplier/products?drafts=1")
  })

  it("supplier post-KYC sends to drafts when ready", () => {
    const progress = buildSupplierFirstSaleProgress({
      kycApproved: true,
      draftCount: 2,
      publishedCount: 0,
      storeSlug: "acme",
    })
    expect(progress.nextStepId).toBe("publish")
    expect(progress.postKycHref).toBe("/dashboard/supplier/products?drafts=1")
  })

  it("supplier hides checklist after first publish", () => {
    const progress = buildSupplierFirstSaleProgress({
      kycApproved: true,
      draftCount: 0,
      publishedCount: 1,
      storeSlug: "acme",
    })
    expect(progress.showChecklist).toBe(false)
    expect(progress.allComplete).toBe(true)
  })

  it("affiliate routes new merchants to catalog", () => {
    const progress = buildAffiliateFirstSaleProgress({
      kycApproved: true,
      listingCount: 0,
      liveListingCount: 0,
      storeSlug: "creator",
    })
    expect(progress.nextStepId).toBe("create")
    expect(progress.steps.find((s) => s.id === "create")?.href).toBe("/dashboard/affiliate/catalog")
  })
})
