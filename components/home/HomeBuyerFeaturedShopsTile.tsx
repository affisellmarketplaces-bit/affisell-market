import Link from "next/link"
import { ArrowUpRight, Store } from "lucide-react"

import { FEATURED_SHOPS_TILE } from "@/lib/buyer-smart-services"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-data"
import { cn } from "@/lib/utils"

const tileLinkClass =
  "group relative flex h-full min-h-[5.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-3.5 shadow-lg shadow-violet-950/20 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15 hover:shadow-xl hover:shadow-violet-950/30 active:scale-[0.99] sm:min-h-[6rem] sm:p-4"

type Props = {
  shops: PublicShopDirectoryEntry[]
}

/** Featured creator storefronts — replaces the old strip below the hero. */
export function HomeBuyerFeaturedShopsTile({ shops }: Props) {
  const featured = shops.slice(0, 3)
  const { href, label, hint, accent } = FEATURED_SHOPS_TILE

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
          {featured.length > 0 ? (
            <span className="flex shrink-0 items-center -space-x-2">
              {featured.map((shop, i) => (
                <span
                  key={shop.slug}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border-2 border-white/30 bg-white/20 shadow-inner ring-1 ring-white/20",
                    i > 0 && "z-[1]"
                  )}
                  style={{ zIndex: featured.length - i }}
                >
                  {shop.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-sm font-bold text-white">{shop.name.slice(0, 1)}</span>
                  )}
                </span>
              ))}
            </span>
          ) : (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner",
                accent
              )}
            >
              <Store className="h-4 w-4 text-white" aria-hidden />
            </span>
          )}
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
