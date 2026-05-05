import { notFound, redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"

/** Canonical product URL for the agent: resolve to a marketplace listing when one exists. */
export default async function ProductByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id?.trim()) notFound()

  const listing = await prisma.affiliateProduct.findFirst({
    where: { productId: id, isListed: true, product: { active: true } },
    select: { id: true },
    orderBy: { id: "asc" },
  })
  if (listing) {
    redirect(`/marketplace/${listing.id}`)
  }

  const product = await prisma.product.findFirst({
    where: { id, active: true },
    select: { id: true },
  })
  if (!product) notFound()

  redirect("/marketplace")
}
