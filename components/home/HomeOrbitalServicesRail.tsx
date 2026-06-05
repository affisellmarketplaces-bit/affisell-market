"use client"

import Link from "next/link"
import { Crown, Gavel, Heart } from "lucide-react"
import { useTranslations } from "next-intl"

import { homeOrbitalBand, homeOrbitalGlow, homeOrbitalTile } from "@/components/home/home-hero-tokens"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import { cn } from "@/lib/utils"

type OrbitalTile = {
  href: string
  label: string
  hint: string
  Icon: typeof Gavel
  accentKey: keyof typeof BUYER_TILE_ACCENTS
}

/** Verticals secondaires — 3 tuiles max, sans doublon hero / footer. */
export function HomeOrbitalServicesRail() {
  const t = useTranslations("home.buyerServices")
  const tRail = useTranslations("home.orbitalRail")

  const tiles: OrbitalTile[] = [
    {
      href: "/auctions",
      label: t("auctions"),
      hint: t("auctionsHint"),
      Icon: Gavel,
      accentKey: "auctions",
    },
    {
      href: "/luxe",
      label: t("luxe"),
      hint: t("luxeHint"),
      Icon: Crown,
      accentKey: "luxe",
    },
    {
      href: "/wishlist",
      label: t("wishlist"),
      hint: t("wishlistHint"),
      Icon: Heart,
      accentKey: "wishlist",
    },
  ]

  return (
    <section className={homeOrbitalBand} aria-labelledby="home-orbital-rail-heading">
      <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.04]" aria-hidden />
      <div
        className="pointer-events-none absolute -left-10 top-1/2 size-40 -translate-y-1/2 rounded-full bg-violet-500/20 blur-3xl"
        aria-hidden
      />
      <div className="relative mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/90">
          {tRail("eyebrow")}
        </p>
        <h2 id="home-orbital-rail-heading" className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {tRail("title")}
        </h2>
        <p className="mt-1 max-w-lg text-sm text-violet-100/85">{tRail("subtitle")}</p>
      </div>

      <div className="relative grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map(({ href, label, hint, Icon, accentKey }) => {
          const accent = BUYER_TILE_ACCENTS[accentKey]
          return (
            <Link
              key={href}
              href={href}
              className={cn(homeOrbitalTile, "min-w-0 max-w-none w-full shrink")}
            >
              <span className={cn(homeOrbitalGlow, accent.glow)} aria-hidden />
              <span
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner",
                  accent.icon
                )}
              >
                <Icon className="size-4 text-white" aria-hidden />
              </span>
              <span className="relative mt-4 block">
                <span className="text-sm font-bold leading-snug text-white">{label}</span>
                <span className="mt-1 block text-[11px] leading-snug text-violet-100/80">{hint}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
