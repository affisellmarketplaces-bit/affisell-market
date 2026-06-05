import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

export const buyerServiceTileClass =
  "group relative flex h-full min-h-[5.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-3.5 shadow-lg shadow-violet-950/20 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15 hover:shadow-xl hover:shadow-violet-950/30 active:scale-[0.99] sm:min-h-[6rem] sm:p-4"

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
    <li className="min-w-0">
      <Link href={href} className={buyerServiceTileClass}>
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
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold leading-snug text-white">{label}</span>
            {liveBadge && liveLabel ? (
              <span className="rounded-full border border-white/30 bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm shadow-red-950/30">
                {liveLabel}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-violet-100/85">{hint}</span>
        </span>
      </Link>
    </li>
  )
}
