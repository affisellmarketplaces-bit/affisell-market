import { merchantVerificationGate, type MerchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"

export type SupplierPublishReadiness = {
  verification: MerchantVerificationGate & { status: string | null }
  draftCount: number
  publishedCount: number
  /** KYC approved and at least one draft waiting to go live. */
  readyToPublish: boolean
  /** Drafts blocked primarily by KYC (not approved). */
  kycBlocked: boolean
}

export async function loadSupplierPublishReadiness(supplierId: string): Promise<SupplierPublishReadiness> {
  const [gate, draftCount, publishedCount] = await Promise.all([
    merchantVerificationGate(supplierId),
    prisma.product.count({
      where: { supplierId, isDraft: true, active: true },
    }),
    prisma.product.count({
      where: { supplierId, isDraft: false, active: true },
    }),
  ])

  const kycBlocked = !gate.allowed && draftCount > 0
  const readyToPublish = gate.allowed && draftCount > 0

  return {
    verification: { ...gate, status: gate.status },
    draftCount,
    publishedCount,
    readyToPublish,
    kycBlocked,
  }
}

export type MerchantPublishPipelineStats = {
  kycPendingWithDrafts: number
  readyToPublish: number
  approvedMerchants: number
}

/** Admin Mission Control — catalogue publish pipeline vs KYC queue. */
export async function loadMerchantPublishPipelineStats(): Promise<MerchantPublishPipelineStats> {
  const [kycPendingWithDrafts, readyToPublish, approvedMerchants] = await Promise.all([
    prisma.user.count({
      where: {
        role: "SUPPLIER",
        products: { some: { isDraft: true, active: true } },
        OR: [
          { merchantLegalProfile: { is: null } },
          { merchantLegalProfile: { verificationStatus: { not: "APPROVED" } } },
        ],
      },
    }),
    prisma.user.count({
      where: {
        role: "SUPPLIER",
        merchantLegalProfile: { verificationStatus: "APPROVED" },
        products: { some: { isDraft: true, active: true } },
      },
    }),
    prisma.merchantLegalProfile.count({ where: { verificationStatus: "APPROVED" } }),
  ])

  return { kycPendingWithDrafts, readyToPublish, approvedMerchants }
}
