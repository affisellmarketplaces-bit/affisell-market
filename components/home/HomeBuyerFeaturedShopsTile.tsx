import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import {
  buyerServiceTileClass,
  buyerServiceTileItemClass,
} from "@/components/home/home-buyer-glass-tile"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"
import { cn } from "@/lib/utils"

type Props = {
  shops: PublicShopDirectoryEntry[]
  label: string
  hint: string
  badgeLabel: string
}

/** Tuile « Une » — boutiques créateurs à la une. */
export function HomeBuyerFeaturedShopsTile({ shops: _shops, label, hint, badgeLabel }: Props) {
  const accent = BUYER_TILE_ACCENTS.stores.glow

  return (
    <li className={buyerServiceTileItemClass}>
      <Link href={PUBLIC_SHOPS_PATH} className={buyerServiceTileClass}>
        <span
          className={cn(
            "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition group-hover:opacity-60",
            accent
          )}
          aria-hidden
        />
        <span className="relative flex shrink-0 items-center justify-between gap-2 max-lg:contents lg:w-full lg:items-start">
          <span
            className={cn(
              "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-xl border-2 border-white/30 bg-gradient-to-br px-1.5 shadow-inner ring-1 ring-white/20 sm:h-9 sm:min-w-9",
              accent
            )}
            aria-hidden
          >
            <span className="text-[10px] font-extrabold leading-none tracking-tight text-white sm:text-[11px]">
              {badgeLabel}
            </span>
          </span>
          <ArrowUpRight
            className="hidden h-4 w-4 shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white lg:block"
            aria-hidden
          />
        </span>
        <span className="relative min-w-0 flex-1 max-lg:mt-0 lg:mt-3 lg:block">
          <span className="block text-xs font-bold leading-snug text-white sm:text-sm">{label}</span>
          <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-violet-100/85 sm:text-[11px] lg:line-clamp-none">
            {hint}
          </span>
        </span>
      </Link>
    </li>
  )
}
