import Image from "next/image"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"

import { BuyButton } from "./buy-button"

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { locale, id } = await params
  const { ref } = await searchParams

  if (ref) {
    const cookieStore = await cookies()
    cookieStore.set("aff_ref", ref, {
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
    })
  }

  const t = await getTranslations({ locale, namespace: "product" })
  const priceLocale = locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US"

  const product = await prisma.product.findUnique({
    where: { id },
    include: { supplier: { select: { name: true, email: true } } },
  })

  if (!product || !product.active) {
    notFound()
  }

  const seller = product.supplier.name || product.supplier.email

  return (
    <main className="mx-auto max-w-2xl p-8">
      {product.image ? (
        <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-lg bg-zinc-100">
          <Image
            src={product.image}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 672px) 100vw, 672px"
            unoptimized={product.image.startsWith("http")}
          />
        </div>
      ) : null}
      <h1 className="text-2xl font-semibold">{product.name}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {product.description || t("noDescription")}
      </p>
      <p className="mt-4 text-lg font-medium">
        {(product.priceCents / 100).toLocaleString(priceLocale, {
          style: "currency",
          currency: "EUR",
        })}
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("soldBy", { seller })}</p>
      <div className="mt-6">
        <BuyButton
          productId={product.id}
          cancelPath={`/${locale}/p/${product.id}`}
          successPath={`/${locale}/success`}
        />
      </div>
    </main>
  )
}
