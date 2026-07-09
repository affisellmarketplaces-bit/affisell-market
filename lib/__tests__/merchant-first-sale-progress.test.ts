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

  it("affiliate routes new merchants to swipe hub", () => {
    const progress = buildAffiliateFirstSaleProgress({
      kycApproved: false,
      listingCount: 0,
      liveListingCount: 0,
      draftListingCount: 0,
      storeSlug: "creator",
    })
    expect(progress.nextStepId).toBe("kyc")
    expect(progress.steps.find((s) => s.id === "create")?.href).toBe(
      "/dashboard/affiliate/hub?mode=swipe&onboarding=1"
    )
    expect(progress.postKycHref).toBe("/dashboard/affiliate/hub?mode=swipe&onboarding=1")
  })

  it("affiliate post-KYC sends to dashboard when draft exists", () => {
    const progress = buildAffiliateFirstSaleProgress({
      kycApproved: true,
      listingCount: 1,
      liveListingCount: 0,
      draftListingCount: 1,
      storeSlug: "creator",
      latestDraftHref: "/dashboard/affiliate/products/listing-1/edit",
    })
    expect(progress.nextStepId).toBe("publish")
    expect(progress.postKycHref).toBe("/dashboard/affiliate/products/listing-1/edit")
    expect(progress.steps.find((s) => s.id === "publish")?.href).toBe(
      "/dashboard/affiliate/products/listing-1/edit"
    )
  })
})
