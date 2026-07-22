import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BubbleProductPageClient } from "@/components/product/BubbleProductPageClient"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"
import { prisma } from "@/lib/prisma"
import { psychologicalPrice } from "@/lib/import/smart-import-enricher"

type PageProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const product = await loadBubbleProductView(id)
  if (!product) return { title: "Produit · Affisell" }
  return {
    title: `${product.title} · Bulle Affisell`,
    description: `${product.salePrice}€ · +${product.marginEuro}€ sans stock`,
    openGraph: {
      title: product.title,
      images: [`/product/${id}/bubble/opengraph-image`],
    },
  }
}

export default async function BubbleProductPage({ params }: PageProps) {
  const { id } = await params
  const product = await loadBubbleProductView(id)
  if (!product) notFound()

  const siblings = await prisma.product.findMany({
    where: { active: true, id: { not: id } },
    take: 6,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
    },
  })

  const similar = siblings.map((p) => {
    const cost = p.basePriceCents / 100
    const sale = psychologicalPrice(cost * 3.2)
    return {
      id: p.id,
      title: p.name,
      imageUrl: p.images.find((u) => u?.startsWith("http")) ?? p.images[0] ?? null,
      salePrice: sale,
      marginEuro: Math.max(0, Math.round((sale - cost) * 100) / 100),
    }
  })

  return (
    <BubbleProductPageClient
      product={product}
      similar={similar}
      catalogSocialHref={`/dashboard/reseller/products/${encodeURIComponent(id)}/social`}
    />
  )
}
