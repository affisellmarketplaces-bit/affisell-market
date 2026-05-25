import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { auth } from "@/auth"
import { WishlistHeart } from "@/components/wishlist-heart"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export const dynamic = "force-dynamic"

function dropPercent(current: number, previous: number | null): number {
  if (!previous || previous <= 0 || current >= previous) return 0
  return Math.max(1, Math.round(((previous - current) / previous) * 100))
}

export default async function WishlistPage() {
  const t = await getTranslations("wishlist")
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect("/signup/customer?callbackUrl=/wishlist")

  const rows = await prisma.wishlist.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          affiliateProducts: {
            where: buyerListedAffiliateProductWhere,
            take: 1,
            orderBy: { id: "asc" },
            select: { id: true, sellingPriceCents: true },
          },
        },
      },
    },
  })

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {t("empty")}
          <Link href="/#explorer" className="ml-2 font-medium text-violet-600 underline dark:text-violet-400">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {rows.map((w) => {
            const listing = w.product.affiliateProducts[0] ?? null
            const current = listing?.sellingPriceCents ?? null
            const pct = current != null ? dropPercent(current, w.previousPriceCents) : 0
            const imageUrl = w.product.images[0] ?? null
            return (
              <article
                key={w.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
              >
                <Link href={listing ? `/marketplace/${listing.id}` : "/shops/browse"} className="shrink-0">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-md border border-zinc-200 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-xs text-zinc-400">
                      Image
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={listing ? `/marketplace/${listing.id}` : "/shops/browse"}
                    className="line-clamp-2 font-medium text-zinc-900 hover:underline"
                  >
                    {w.product.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-zinc-900">
                      {current != null ? formatStoreCurrencyFromCents(current) : "N/A"}
                    </span>
                    {w.targetPriceCents != null ? (
                      <span className="text-zinc-500">
                        cible {formatStoreCurrencyFromCents(w.targetPriceCents)}
                      </span>
                    ) : null}
                    {pct > 0 ? (
                      <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                        🔔 -{pct}% depuis hier
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <WishlistHeart productId={w.productId} />
                  <Link
                    href={listing ? `/marketplace/${listing.id}` : "/shops/browse"}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                  >
                    Voir
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
