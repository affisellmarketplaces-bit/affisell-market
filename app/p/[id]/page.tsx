import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"

import { BuyButton } from "./buy-button"
import { RefCookieSetter } from "./ref-cookie"

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { id } = await params
  const { ref } = await searchParams

  const product = await prisma.product.findUnique({
    where: { id },
    include: { supplier: { select: { name: true, email: true } } },
  })

  if (!product || !product.active) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <RefCookieSetter refId={ref} />
      <h1 className="text-2xl font-semibold">{product.name}</h1>
      <p className="mt-2 text-sm text-zinc-600">{product.description || "Aucune description"}</p>
      <p className="mt-4 text-lg font-medium">{(product.price / 100).toLocaleString("fr-FR")} EUR</p>
      <p className="mt-1 text-sm text-zinc-500">
        Vendu par {product.supplier.name || product.supplier.email}
      </p>
      <div className="mt-6">
        <BuyButton productId={product.id} />
      </div>
    </main>
  )
}
