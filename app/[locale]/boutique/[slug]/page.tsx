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
  const { slug } = await params
  const t = await getTranslations("boutique")

  const store = await prisma.affiliateStore.findUnique({
    where: { slug },
  })
  if (!store) {
    notFound()
  }

  const links = await prisma.affiliateProduct.findMany({
    where: { affiliateId: store.userId, active: true },
    include: {
      product: {
        include: { supplier: { select: { email: true } } },
      },
    },
    orderBy: { id: "desc" },
  })

  type LinkRow = (typeof links)[number]
  type LinkWithProduct = LinkRow & { product: NonNullable<LinkRow["product"]> }
  function isActiveListing(l: LinkRow): l is LinkWithProduct {
    return Boolean(l.product?.active)
  }
  const items = links.filter(isActiveListing)

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
            {items.map((link: LinkWithProduct) => (
                <article key={link.id} className="flex flex-col">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                    {link.product.image ? (
                      <Image
                        src={link.product.image}
                        alt={link.product.name}
                        fill
                        className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        unoptimized={link.product.image.startsWith("http")}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-400">{link.product.name}</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-1 pt-5">
                    <h2 className="text-lg font-semibold leading-snug">{link.product.name}</h2>
                    {link.product.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{link.product.description}</p>
                    ) : null}
                    <p className="mt-3 text-xl font-semibold tracking-tight">
                      {(link.sellingPriceCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">{link.product.supplier.email}</p>
                    <BoutiqueBuyButton
                      affiliateProductId={link.id}
                      cancelPath={`/boutique/${slug}`}
                      successPath="/success"
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
