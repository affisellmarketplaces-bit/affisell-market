import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { auth } from "@/auth"
import { WishlistHeart } from "@/components/wishlist-heart"
import { listGuestWishlistForDisplay, type WishlistDisplayRow } from "@/lib/guest-wishlist-server"
import { readGuestWishlistId } from "@/lib/guest-wishlist-id"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { signupCustomerPath } from "@/lib/login-redirect"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function dropPercent(current: number, previous: number | null): number {
  if (!previous || previous <= 0 || current >= previous) return 0
  return Math.max(1, Math.round(((previous - current) / previous) * 100))
}

async function loadUserWishlistRows(userId: string): Promise<WishlistDisplayRow[]> {
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

  return rows.map((w) => {
    const listing = w.product.affiliateProducts[0] ?? null
    const current = listing?.sellingPriceCents ?? null
    return {
      productId: w.productId,
      name: w.product.name,
      imageUrl: w.product.images[0] ?? null,
      listingId: listing?.id ?? null,
      currentPriceCents: current,
      targetPriceCents: w.targetPriceCents,
      dropPercent: current != null ? dropPercent(current, w.previousPriceCents) : 0,
    }
  })
}

export default async function WishlistPage() {
  const t = await getTranslations("wishlist")
  const tHeart = await getTranslations("wishlist.heart")
  const session = await auth()
  const userId = session?.user?.id

  const rows = userId
    ? await loadUserWishlistRows(userId)
    : await listGuestWishlistForDisplay((await readGuestWishlistId()) ?? "")

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>

      {!userId ? (
        <div className="mt-4 rounded-xl border border-violet-200/80 bg-violet-50/80 px-4 py-3 text-sm text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100">
          <p>{t("guestBanner")}</p>
          <Link
            href={signupCustomerPath("/wishlist")}
            className="mt-2 inline-flex font-semibold text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-300"
          >
            {t("guestBannerCta")}
          </Link>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {t("empty")}
          <Link href="/marketplace" className="ml-2 font-medium text-violet-600 underline dark:text-violet-400">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {rows.map((w) => {
            const listingHref = w.listingId ? `/marketplace/${w.listingId}` : "/shops/browse"
            return (
              <article
                key={w.productId}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Link href={listingHref} className="shrink-0">
                  {w.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
                      {t("noImage")}
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={listingHref}
                    className="line-clamp-2 font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {w.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {w.currentPriceCents != null ? formatStoreCurrencyFromCents(w.currentPriceCents) : "N/A"}
                    </span>
                    {w.targetPriceCents != null ? (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {t("targetPrice", {
                          price: formatStoreCurrencyFromCents(w.targetPriceCents),
                        })}
                      </span>
                    ) : null}
                    {w.dropPercent > 0 ? (
                      <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {t("dropBadge", { pct: w.dropPercent, since: tHeart("dropSinceYesterday") })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <WishlistHeart productId={w.productId} />
                  <Link
                    href={listingHref}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                  >
                    {t("viewProduct")}
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
