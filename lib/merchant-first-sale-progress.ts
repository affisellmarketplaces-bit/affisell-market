import { AFFILIATE_FIRST_LISTING_HUB_HREF } from "@/lib/affiliate-onboarding-shared"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { affiliateListingsWhere, supplierDraftProductsWhere, supplierPublishedProductsWhere } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"

export type MerchantOnboardingStepId = "kyc" | "create" | "publish" | "share"

export type MerchantOnboardingStep = {
  id: MerchantOnboardingStepId
  done: boolean
  href: string
}

export type MerchantFirstSaleProgress = {
  kycApproved: boolean
  kycReason?: string | null
  steps: MerchantOnboardingStep[]
  nextStepId: MerchantOnboardingStepId | null
  allComplete: boolean
  /** Redirect target right after KYC approval. */
  postKycHref: string
  showChecklist: boolean
  draftListingCount: number
  latestDraftHref?: string | null
}

function supplierShareHref(storeSlug: string | null): string {
  return storeSlug ? `/store/supplier/${storeSlug}` : "/dashboard/supplier/storefront"
}

export function buildSupplierFirstSaleProgress(args: {
  kycApproved: boolean
  kycReason?: string | null
  draftCount: number
  publishedCount: number
  storeSlug: string | null
}): MerchantFirstSaleProgress {
  const productCount = args.draftCount + args.publishedCount
  const createDone = productCount > 0
  const publishDone = args.publishedCount > 0
  const shareDone = publishDone && Boolean(args.storeSlug)

  const steps: MerchantOnboardingStep[] = [
    {
      id: "kyc",
      done: args.kycApproved,
      href: "/dashboard/verification",
    },
    {
      id: "create",
      done: createDone,
      href: "/dashboard/supplier/products/new",
    },
    {
      id: "publish",
      done: publishDone,
      href: args.kycApproved
        ? "/dashboard/supplier/products?drafts=1"
        : "/dashboard/verification",
    },
    {
      id: "share",
      done: shareDone,
      href: supplierShareHref(args.storeSlug),
    },
  ]

  const nextStep = steps.find((s) => !s.done) ?? null

  let postKycHref = "/dashboard/supplier"
  if (args.draftCount > 0 && args.kycApproved) {
    postKycHref = "/dashboard/supplier/products?drafts=1"
  } else if (!createDone) {
    postKycHref = "/dashboard/supplier/products/new"
  } else if (!publishDone) {
    postKycHref = "/dashboard/supplier/products?drafts=1"
  }

  return {
    kycApproved: args.kycApproved,
    kycReason: args.kycReason,
    steps,
    nextStepId: nextStep?.id ?? null,
    allComplete: steps.every((s) => s.done),
    postKycHref,
    showChecklist: !publishDone,
    draftListingCount: args.draftCount,
  }
}

export function buildAffiliateFirstSaleProgress(args: {
  kycApproved: boolean
  kycReason?: string | null
  listingCount: number
  liveListingCount: number
  draftListingCount: number
  storeSlug: string | null
  latestDraftHref?: string | null
}): MerchantFirstSaleProgress {
  const createDone = args.listingCount > 0
  const publishDone = args.liveListingCount > 0
  const shareDone = publishDone && Boolean(args.storeSlug)
  const hubHref = AFFILIATE_FIRST_LISTING_HUB_HREF
  const draftPublishHref = args.latestDraftHref ?? "/dashboard/affiliate"

  const steps: MerchantOnboardingStep[] = [
    {
      id: "kyc",
      done: args.kycApproved,
      href: "/dashboard/verification",
    },
    {
      id: "create",
      done: createDone,
      href: hubHref,
    },
    {
      id: "publish",
      done: publishDone,
      href: args.kycApproved
        ? draftPublishHref
        : args.draftListingCount > 0
          ? "/dashboard/verification"
          : hubHref,
    },
    {
      id: "share",
      done: shareDone,
      href: args.storeSlug ? `/shops/${args.storeSlug}` : "/dashboard/affiliate/brand-studio",
    },
  ]

  const nextStep = steps.find((s) => !s.done) ?? null

  let postKycHref = "/dashboard/affiliate"
  if (!createDone) {
    postKycHref = hubHref
  } else if (!publishDone) {
    postKycHref = draftPublishHref
  }

  return {
    kycApproved: args.kycApproved,
    kycReason: args.kycReason,
    steps,
    nextStepId: nextStep?.id ?? null,
    allComplete: steps.every((s) => s.done),
    postKycHref,
    showChecklist: !publishDone,
    draftListingCount: args.draftListingCount,
    latestDraftHref: args.latestDraftHref ?? null,
  }
}

export async function loadSupplierFirstSaleProgress(
  supplierId: string,
  storeSlug: string | null
): Promise<MerchantFirstSaleProgress> {
  const [gate, draftCount, publishedCount] = await Promise.all([
    merchantVerificationGate(supplierId),
    prisma.product.count({ where: supplierDraftProductsWhere(supplierId) }),
    prisma.product.count({ where: supplierPublishedProductsWhere(supplierId) }),
  ])

  return buildSupplierFirstSaleProgress({
    kycApproved: gate.allowed,
    kycReason: gate.reason ?? null,
    draftCount,
    publishedCount,
    storeSlug,
  })
}

export async function loadAffiliateFirstSaleProgress(
  affiliateId: string
): Promise<MerchantFirstSaleProgress> {
  const [gate, listingCount, liveListingCount, store, latestDraft] = await Promise.all([
    merchantVerificationGate(affiliateId),
    prisma.affiliateProduct.count({ where: affiliateListingsWhere(affiliateId) }),
    prisma.affiliateProduct.count({
      where: { ...affiliateListingsWhere(affiliateId), isListed: true },
    }),
    prisma.store.findUnique({ where: { userId: affiliateId }, select: { slug: true } }),
    prisma.affiliateProduct.findFirst({
      where: { ...affiliateListingsWhere(affiliateId), isListed: false },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  return buildAffiliateFirstSaleProgress({
    kycApproved: gate.allowed,
    kycReason: gate.reason ?? null,
    listingCount,
    liveListingCount,
    draftListingCount: listingCount - liveListingCount,
    storeSlug: store?.slug ?? null,
    latestDraftHref: latestDraft ? `/dashboard/affiliate/products/${latestDraft.id}/edit` : null,
  })
}
