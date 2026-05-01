import Image from "next/image"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params
  const t = await getTranslations("marketplace")

  const listings = await prisma.affiliateProduct.findMany({
    where: { active: true, product: { active: true } },
    include: {
      product: true,
      affiliate: { select: { email: true } },
    },
    orderBy: { id: "desc" },
  })

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="border-b border-zinc-200 bg-white px-4 py-10 dark:border-zinc-800 dark:bg-zinc-900 md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-widest text-zinc-500">{t("title")}</p>
          <h1 className="mt-2 text-3xl font-semibold">{t("subtitle")}</h1>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {listings.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">{t("empty")}</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((item) =>
              item.product ? (
                <Link
                  key={item.id}
                  href={`/marketplace/${item.id}`}
                  className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <div className="relative aspect-[4/5] bg-zinc-100 dark:bg-zinc-800">
                    {item.product.image ? (
                      <Image
                        src={item.product.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 100vw, 33vw"
                        unoptimized={item.product.image.startsWith("http")}
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <h2 className="text-lg font-semibold">{item.product.name}</h2>
                    <p className="text-xl font-semibold">
                      {(item.sellingPriceCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </p>
                    <p className="text-xs text-zinc-500">{t("sellerLabel")}: {item.affiliate.email}</p>
                  </div>
                </Link>
              ) : null
            )}
          </div>
        )}
      </section>
    </main>
  )
}
