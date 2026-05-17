import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { SupplierProductVideoPanel } from "@/components/supplier/supplier-product-video-panel"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function SupplierProductVideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/supplier/products")
  }
  if (session.user.role !== "SUPPLIER") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-600">
        Supplier access only.
      </div>
    )
  }

  const { id } = await params
  const product = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    select: { id: true, name: true, isDraft: true },
  })

  if (!product) notFound()

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100/90 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/95">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-12">
        <nav className="mb-8 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/dashboard/supplier/products"
            className="font-medium text-teal-700 hover:text-teal-900 dark:text-teal-400"
          >
            ← Produits
          </Link>
          <Link
            href={`/dashboard/supplier/products/new?edit=${product.id}`}
            className="text-zinc-600 underline dark:text-zinc-400"
          >
            Modifier la fiche
          </Link>
        </nav>

        {product.isDraft ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            Publiez le produit avant de générer une vidéo pub.
          </p>
        ) : null}

        <SupplierProductVideoPanel productId={product.id} productName={product.name} />
      </div>
    </div>
  )
}
