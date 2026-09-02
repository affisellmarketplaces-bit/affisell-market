import type { Prisma } from "@prisma/client"

import {
  AFFILIATE_LEGAL_QUALIFICATION,
  affiliateSaleAmountsFromOrder,
} from "@/lib/legal/affiliate-commissionnaire-shared"
import { prisma } from "@/lib/prisma"

type OrderSaleSnapshot = {
  id: string
  affiliateId: string
  supplierId: string
  supplierPriceCents: number
  affiliateMarginCents: number
  affiliatePayoutCents: number
  sellingPriceCents: number
}

/** Resolve public invoice seller name for an affiliate-commissionnaire. */
export async function resolveAffiliateCommissionnaireSellerName(
  affiliateId: string
): Promise<string> {
  const [store, profile] = await Promise.all([
    prisma.store.findUnique({
      where: { userId: affiliateId },
      select: { name: true },
    }),
    prisma.merchantLegalProfile.findUnique({
      where: { userId: affiliateId },
      select: { legalEntityName: true, tradeName: true },
    }),
  ])

  return (
    profile?.legalEntityName?.trim() ||
    profile?.tradeName?.trim() ||
    store?.name?.trim() ||
    "Affilié-Commissionnaire"
  )
}

/** Resolve supplier legal / trade name for invoices and checkout disclaimers. */
export async function resolveSupplierSellerName(supplierId: string): Promise<string> {
  const profile = await prisma.merchantLegalProfile.findUnique({
    where: { userId: supplierId },
    select: { legalEntityName: true, tradeName: true },
  })
  if (profile?.legalEntityName?.trim()) return profile.legalEntityName.trim()
  if (profile?.tradeName?.trim()) return profile.tradeName.trim()

  const user = await prisma.user.findUnique({
    where: { id: supplierId },
    select: { name: true, email: true },
  })
  return user?.name?.trim() || user?.email?.trim() || "Fournisseur"
}

/**
 * Idempotent upsert of AffiliateSale (1:1 Order) — proves pricing freedom & double billing split.
 */
export async function recordAffiliateSaleFromOrder(
  tx: Prisma.TransactionClient,
  order: OrderSaleSnapshot
): Promise<void> {
  const amounts = affiliateSaleAmountsFromOrder(order)

  await tx.affiliateSale.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      affiliateId: order.affiliateId,
      supplierId: order.supplierId,
      supplierPriceCents: amounts.supplierPriceCents,
      marginAmountCents: amounts.marginAmountCents,
      commissionAmountCents: amounts.commissionAmountCents,
      resalePriceCents: amounts.resalePriceCents,
      pricingFreedom: amounts.pricingFreedom,
      legalQualification: AFFILIATE_LEGAL_QUALIFICATION,
    },
    update: {
      supplierPriceCents: amounts.supplierPriceCents,
      marginAmountCents: amounts.marginAmountCents,
      commissionAmountCents: amounts.commissionAmountCents,
      resalePriceCents: amounts.resalePriceCents,
      pricingFreedom: amounts.pricingFreedom,
      legalQualification: AFFILIATE_LEGAL_QUALIFICATION,
    },
  })

  await tx.order.update({
    where: { id: order.id },
    data: { pricingFreedom: amounts.pricingFreedom },
  })

  console.log("[affiliate-commissionnaire]", {
    orderId: order.id,
    marginAmountCents: amounts.marginAmountCents,
    commissionAmountCents: amounts.commissionAmountCents,
    resalePriceCents: amounts.resalePriceCents,
    pricingFreedom: amounts.pricingFreedom,
    result: "affiliate_sale_recorded",
  })
}
