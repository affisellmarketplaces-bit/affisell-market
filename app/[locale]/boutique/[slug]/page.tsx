import Image from "next/image"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { prisma } from "@/lib/prisma"

import { BoutiqueBuyButton } from "./boutique-buy-button"

export const dynamic = "force-dynamic"

export default async function PublicBoutiquePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: "boutique" })

  const store = await prisma.affiliateStore.findUnique({
    where: { slug },
  })
  if (!store) {
    notFound()
  }

  const links = await prisma.affiliateProduct.findMany({
    where: { affiliateId: store.userId },
    include: {
      product: {
        include: { supplier: { select: { name: true, email: true } } },
      },
    },
    orderBy: { addedAt: "desc" },
  })
  type LinkRow = (typeof links)[number]
  type ProductCard = NonNullable<LinkRow["product"]>

  const items: ProductCard[] = links
    .map((l: LinkRow) => l.product)
    .filter((p: ProductCard | null): p is ProductCard => Boolean(p?.active))

  const priceLocale =
    locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US"

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-10 md:px-8">
          <p className="text-xs uppercase tracking-widest text-zinc-500">{t("tagline")}</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{store.slug}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {items.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
        ) : (
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <article key={p.id} className="flex flex-col">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      unoptimized={p.image.startsWith("http")}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-400">{p.name}</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col px-1 pt-5">
                  <h2 className="text-lg font-semibold leading-snug">{p.name}</h2>
                  {p.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{p.description}</p>
                  ) : null}
                  <p className="mt-3 text-xl font-semibold tracking-tight">
                    {(p.priceCents / 100).toLocaleString(priceLocale, {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {p.supplier.name || p.supplier.email}
                  </p>
                  <BoutiqueBuyButton
                    productId={p.id}
                    affiliateId={store.userId}
                    cancelPath={`/${locale}/boutique/${slug}`}
                    successPath={`/${locale}/success`}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
