import Image from "next/image"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { GenerateVideoButton } from "@/components/GenerateVideoButton"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function SupplierProductPage({
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

  const [product, user, productVideo] = await Promise.all([
    prisma.product.findFirst({
      where: { id, supplierId: session.user.id },
      select: { id: true, name: true, images: true, isDraft: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { videoQuota: true, videoUsed: true, isPro: true },
    }),
    prisma.productVideo.findUnique({
      where: { productId: id },
      select: { videoUrl: true, style: true },
    }),
  ])

  if (!product || !user) notFound()

  const images = (product.images ?? []).filter((u) => typeof u === "string" && u.trim())
  const remaining = Math.max(0, user.videoQuota - user.videoUsed)

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

        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{product.name}</h1>

        {!user.isPro ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{remaining}</span>
            /{user.videoQuota} vidéos restantes
          </p>
        ) : null}

        {images.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((src) => (
              <div
                key={src}
                className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 200px"
                  unoptimized={src.startsWith("data:")}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">Aucune image produit.</p>
        )}

        <GenerateVideoButton
          className="mt-6"
          productId={product.id}
          productName={product.name}
          quota={{
            videoQuota: user.videoQuota,
            videoUsed: user.videoUsed,
            isPro: user.isPro,
          }}
          initialVideoUrl={productVideo?.videoUrl ?? null}
          initialStyle={productVideo?.style ?? null}
        />

        {product.isDraft ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            Publiez le produit avant de générer une vidéo pub.
          </p>
        ) : null}
      </div>
    </div>
  )
}
