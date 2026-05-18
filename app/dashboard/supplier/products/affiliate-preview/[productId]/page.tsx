import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { auth } from "@/auth"
import { SupplierAffiliateEvalPreview } from "@/components/supplier/supplier-affiliate-eval-preview"
import { prisma } from "@/lib/prisma"
import { serializeProductDecimalFields } from "@/lib/serialize-for-client"
import { supplierFacingPartnerListingRef } from "@/lib/supplier-partner-listing-ref"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>
}): Promise<Metadata> {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUPPLIER") return { title: "Preview" }
  const { productId } = await params
  const id = productId?.trim()
  if (!id) return { title: "Preview" }
  const p = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    select: { name: true },
  })
  return {
    title: p ? `${p.name.slice(0, 72)} · Partner preview` : "Partner preview",
    description: "How resellers read your SKU—pricing anchor, margin, and fulfillment signals before they list.",
  }
}

export default async function SupplierAffiliatePreviewPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUPPLIER") notFound()

  const { productId } = await params
  const id = productId?.trim()
  if (!id) notFound()

  const liveAffiliateListingWhere = {
    productId: id,
    isListed: true,
    product: { active: true },
    affiliate: { role: "AFFILIATE" as const },
  }

  const [product, example, affiliatesWhoListed] = await Promise.all([
    prisma.product.findFirst({
      where: { id, supplierId: session.user.id },
      select: {
        id: true,
        name: true,
        description: true,
        basePriceCents: true,
        compareAt: true,
        commissionRate: true,
        listingKind: true,
        stock: true,
        active: true,
        isDraft: true,
        images: true,
        categories: true,
        tags: true,
        deliveryMin: true,
        deliveryMax: true,
        handlingDays: true,
        shippingCountry: true,
        shippingType: true,
        variants: true,
        colorImages: true,
      },
    }),
    prisma.affiliateProduct.findFirst({
      where: liveAffiliateListingWhere,
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["affiliateId"],
      where: liveAffiliateListingWhere,
    }),
  ])

  const listedAffiliateCount = affiliatesWhoListed.length

  if (!product) notFound()

  const editHref = product.isDraft
    ? `/dashboard/supplier/products/new?compose=1&draft=${product.id}`
    : `/dashboard/supplier/products/new?edit=${product.id}`

  const exampleRow =
    example && listedAffiliateCount > 0
      ? { partnerListingRef: supplierFacingPartnerListingRef(example.id) }
      : null

  return (
    <SupplierAffiliateEvalPreview
      product={serializeProductDecimalFields(product)}
      editHref={editHref}
      catalogHref="/dashboard/supplier/products"
      listedAffiliateCount={listedAffiliateCount}
      example={exampleRow}
    />
  )
}
