import { notFound, redirect } from "next/navigation"

import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

/** Canonical product URL for the agent: resolve to a marketplace listing when one exists. */
export default async function ProductByIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  if (!id?.trim()) notFound()

  if (sp.view === "bubble" || sp.view === "profit") {
    redirect(`/product/${id}/bubble${sp.view === "profit" ? "#profit" : ""}`)
  }

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      ...buyerListedAffiliateProductWhere,
      productId: id,
    },
    select: { id: true },
    orderBy: { id: "asc" },
  })
  if (listing) {
    redirect(`/marketplace/${listing.id}`)
  }

  const product = await prisma.product.findFirst({
    where: { id, ...buyerMarketplaceProductWhere },
    select: { id: true },
  })
  if (!product) notFound()

  redirect("/marketplace")
}
