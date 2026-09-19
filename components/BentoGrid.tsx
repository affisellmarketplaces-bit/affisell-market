import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowUpRight } from "lucide-react"

import { BuyerDiscoverCard } from "@/components/home/buyer-discover-card"
import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { loadBuyerDiscoverCardsCached } from "@/lib/public-home-cache"

export async function BentoGrid() {
  const cards = await loadBuyerDiscoverCardsCached()
  if (cards.length === 0) return null
  const t = await getTranslations("homeDiscover")

  return (
    <section className="min-w-0 px-0 py-1 sm:py-2" aria-labelledby="buyer-discover-heading">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3 sm:mb-5">
        <h2
          id="buyer-discover-heading"
          className="min-w-0 text-xl font-bold tracking-tight dark:text-white"
          style={{ color: BUYER_PREMIUM.text.heading }}
        >
          {t("heading")}
        </h2>
        <Link
          href={PUBLIC_MARKETPLACE_BROWSE_PATH}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold transition hover:opacity-80 dark:text-indigo-400"
          style={{ color: BUYER_PREMIUM.discover.link }}
        >
          {t("viewAll")}
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.id} className="min-w-0">
            <BuyerDiscoverCard card={card} />
          </div>
        ))}
      </div>
    </section>
  )
}
