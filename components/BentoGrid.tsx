import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { BuyerDiscoverCard } from "@/components/home/buyer-discover-card"
import { BUYER_DISCOVER_CARDS } from "@/lib/buyer-premium-home-content"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

/** Buyer premium Discover bento — 4 cards per mockup audit. */
export async function BentoGrid() {
  return (
    <section
      className="rounded-[1.75rem] border border-slate-200/80 bg-white px-4 py-6 shadow-sm sm:px-6 sm:py-8 dark:border-slate-800 dark:bg-slate-950"
      aria-labelledby="buyer-discover-heading"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="buyer-discover-heading" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Discover
        </h2>
        <Link
          href={PUBLIC_MARKETPLACE_BROWSE_PATH}
          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400"
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
