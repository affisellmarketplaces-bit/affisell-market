import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { BuyerDiscoverCard } from "@/components/home/buyer-discover-card"
import { BUYER_DISCOVER_CARDS } from "@/lib/buyer-premium-home-content"
import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

/** Buyer premium Discover bento — 4 cards per mockup audit. */
export async function BentoGrid() {
  return (
    <section className="px-0 py-2 sm:py-3" aria-labelledby="buyer-discover-heading">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2
          id="buyer-discover-heading"
          className="text-xl font-bold tracking-tight dark:text-white"
          style={{ color: BUYER_PREMIUM.text.heading }}
        >
          Discover
        </h2>
        <Link
          href={PUBLIC_MARKETPLACE_BROWSE_PATH}
          className="inline-flex items-center gap-1 text-sm font-semibold transition hover:text-[#3730a3] dark:text-indigo-400"
          style={{ color: BUYER_PREMIUM.discover.link }}
        >
          View all
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {BUYER_DISCOVER_CARDS.map((card) => (
          <BuyerDiscoverCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  )
}
