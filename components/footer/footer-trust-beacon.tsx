"use client"

import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { footerHeroCardTile, footerHeroGlow, footerHeroTagline, footerHeroTitle } from "@/components/footer/footer-hero-tokens"
import type { FooterTrustBeacon } from "@/lib/footer-global-sections"
import { cn } from "@/lib/utils"

type Props = {
  beacon: FooterTrustBeacon
  className?: string
}

/** Buyer trust card — escrow + retours, style glass futuriste. */
export function FooterTrustBeacon({ beacon, className }: Props) {
  return (
    <Link
      href={beacon.href}
      className={cn(
        "affisell-footer-trust-beacon affisell-trust-surface group relative block rounded-2xl p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-950/30",
        className
      )}
    >
      <span
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.08)_50%,transparent_75%)] bg-[length:200%_100%] opacity-0 transition group-hover:opacity-100 group-hover:animate-[footer-shimmer_2.5s_ease-in-out_infinite]"
        aria-hidden
      />
      <span className={cn(footerHeroGlow, "from-emerald-400/80 to-teal-500/80 opacity-50 group-hover:opacity-70")} aria-hidden />
      <div className="relative flex items-start gap-3">
        <span className="affisell-trust-kicker flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/85 to-teal-600/85 shadow-inner shadow-emerald-950/40">
          <ShieldCheck className="size-5 text-white" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={footerHeroTitle}>{beacon.title}</p>
          <p className={cn("mt-1.5 text-sm leading-snug", footerHeroTagline)}>{beacon.hint}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-200 transition group-hover:gap-1.5 group-hover:text-white">
            {beacon.cta}
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function FooterTrustBeaconCompact({ beacon, className }: Props) {
  return (
    <Link
      href={beacon.href}
      className={cn(footerHeroCardTile, "group flex-row items-center gap-3 p-3.5", className)}
    >
      <span className={cn(footerHeroGlow, "from-emerald-400/80 to-teal-500/80")} aria-hidden />
      <span className="affisell-trust-kicker relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/85 to-teal-600/85">
        <ShieldCheck className="size-4 text-white" aria-hidden />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-white">{beacon.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-violet-100/85">{beacon.hint}</p>
      </div>
      <ArrowRight className="relative size-4 shrink-0 text-emerald-200/80 transition group-hover:translate-x-0.5 group-hover:text-white" aria-hidden />
    </Link>
  )
}
