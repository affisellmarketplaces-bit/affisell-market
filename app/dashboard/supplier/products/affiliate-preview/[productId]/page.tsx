import { notFound } from "next/navigation"
import { requireSupplierSession } from "@/lib/dashboard-session"
import type { Metadata } from "next"

import { SupplierAffiliateEvalPreview } from "@/components/supplier/supplier-affiliate-eval-preview"
import { prisma } from "@/lib/prisma"
import { loadSupplierStorefrontCatalogProduct } from "@/lib/supplier-storefront-product-preview"
import { supplierFacingPartnerListingRef } from "@/lib/supplier-partner-listing-ref"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>
}): Promise<Metadata> {
  const session = await requireSupplierSession("/dashboard/supplier/products/affiliate-preview/[productId]")

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
  const session = await requireSupplierSession(
    `/dashboard/supplier/products/affiliate-preview/${(await params).productId}`
  )

  const { productId } = await params
  const id = productId?.trim()
  if (!id) notFound()

  const store = await prisma.store.findUnique({
    where: { userId: session.user.id },
    select: { slug: true },
  })
  if (!store?.slug) notFound()

  const loaded = await loadSupplierStorefrontCatalogProduct({
    storeSlug: store.slug,
    productId: id,
    allowUnpublished: true,
  })
  if (!loaded) notFound()

  const product = loaded.product

  const exampleListing = await prisma.affiliateProduct.findFirst({
    where: {
      productId: id,
      isListed: true,
      product: { active: true },
      affiliate: { role: "AFFILIATE" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  })

  const editHref = product.isDraft
    ? `/dashboard/supplier/products/new?compose=1&draft=${product.id}`
    : `/dashboard/supplier/products/new?edit=${product.id}`

  const exampleRow =
    exampleListing && loaded.listedAffiliateCount > 0
      ? { partnerListingRef: supplierFacingPartnerListingRef(exampleListing.id) }
      : null

  return (
    <SupplierAffiliateEvalPreview
      product={product}
      editHref={editHref}
      catalogHref="/dashboard/supplier/products"
      listedAffiliateCount={loaded.listedAffiliateCount}
      example={exampleRow}
      presentation="supplier-dashboard"
    />
  )
}
