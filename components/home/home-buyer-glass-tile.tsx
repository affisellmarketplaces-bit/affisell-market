import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

export const buyerServiceTileClass =
  "group relative flex h-full min-h-[4.75rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-3 shadow-lg shadow-violet-950/20 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15 hover:shadow-xl hover:shadow-violet-950/30 active:scale-[0.99] max-lg:min-h-[4.25rem] max-lg:flex-row max-lg:items-center max-lg:gap-2.5 max-lg:p-3 sm:min-h-[6rem] sm:p-4 lg:min-h-[5.5rem] lg:flex-col lg:justify-between"

export const buyerServiceTileItemClass =
  "min-w-0 max-lg:w-[min(11.5rem,78vw)] max-lg:shrink-0 max-lg:snap-start lg:w-auto"

export type BuyerGlassTileProps = {
  href: string
  label: string
  hint: string
  Icon: LucideIcon
  accent: string
  liveBadge?: boolean
  liveLabel?: string
}

export function BuyerGlassTile({
  href,
  label,
  hint,
  Icon,
  accent,
  liveBadge,
  liveLabel,
}: BuyerGlassTileProps) {
  return (
    <li className={buyerServiceTileItemClass}>
      <Link href={href} className={buyerServiceTileClass}>
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
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner sm:h-9 sm:w-9",
              accent
            )}
          >
            <Icon className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" aria-hidden />
          </span>
          <ArrowUpRight
            className="hidden h-4 w-4 shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white lg:block"
            aria-hidden
          />
        </span>
        <span className="relative min-w-0 flex-1 max-lg:mt-0 lg:mt-3 lg:block">
          <span className="flex flex-wrap items-center gap-1 max-lg:gap-1 lg:gap-1.5">
            <span className="text-xs font-bold leading-snug text-white sm:text-sm">{label}</span>
            {liveBadge && liveLabel ? (
              <span className="rounded-full border border-white/30 bg-red-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm shadow-red-950/30 sm:text-[9px]">
                {liveLabel}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-violet-100/85 sm:text-[11px] lg:line-clamp-none">
            {hint}
          </span>
        </span>
      </Link>
    </li>
  )
}
