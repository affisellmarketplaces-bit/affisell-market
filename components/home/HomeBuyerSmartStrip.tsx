import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { HomeBuyerFeaturedShopsTile } from "@/components/home/HomeBuyerFeaturedShopsTile"
import { BUYER_SMART_SERVICES, type BuyerSmartService } from "@/lib/buyer-smart-services"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"
import { cn } from "@/lib/utils"

type Props = {
  featuredShops: PublicShopDirectoryEntry[]
}

const tileLinkClass =
  "group relative flex h-full min-h-[5.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-3.5 shadow-lg shadow-violet-950/20 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15 hover:shadow-xl hover:shadow-violet-950/30 active:scale-[0.99] sm:min-h-[6rem] sm:p-4"

function BuyerServiceTile({ href, label, hint, Icon, accent }: BuyerSmartService) {
  return (
    <li className="min-w-0">
      <Link href={href} className={tileLinkClass}>
        <span
          className={cn(
            "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition group-hover:opacity-60",
            accent
          )}
          aria-hidden
        />
        <span className="relative flex items-start justify-between gap-2">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner",
              accent
            )}
          >
            <Icon className="h-4 w-4 text-white" aria-hidden />
          </span>
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
            aria-hidden
          />
        </span>
        <span className="relative mt-3 block text-left">
          <span className="block text-sm font-bold leading-snug text-white">{label}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-violet-100/85">{hint}</span>
        </span>
      </Link>
    </li>
  )
}

/** Buyer shortcuts anchored on the lower edge of the home hero band. */
export function HomeBuyerSmartStrip({ featuredShops }: Props) {
  const [agent, catalogue, boutiques] = BUYER_SMART_SERVICES

  return (
    <div
      className="relative mt-10 border-t border-white/20 pt-8 sm:mt-12 sm:pt-10"
      aria-labelledby="buyer-smart-strip-heading"
    >
      <p
        id="buyer-smart-strip-heading"
        className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-100/90"
      >
        Acheter malin sur Affisell
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {agent ? <BuyerServiceTile {...agent} /> : null}
        <HomeBuyerFeaturedShopsTile shops={featuredShops} />
        {catalogue ? <BuyerServiceTile {...catalogue} /> : null}
        {boutiques ? <BuyerServiceTile {...boutiques} /> : null}
      </ul>
    </div>
  )
}
