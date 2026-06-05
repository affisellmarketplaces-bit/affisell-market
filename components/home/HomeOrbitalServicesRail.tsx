"use client"

import Link from "next/link"
import { ArrowRight, Bot, Crown, Gavel, Heart, Store } from "lucide-react"
import { useTranslations } from "next-intl"

import { homeOrbitalBand, homeOrbitalGlow, homeOrbitalTile } from "@/components/home/home-hero-tokens"
import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import { cn } from "@/lib/utils"

type OrbitalTile = {
  href: string
  label: string
  hint: string
  Icon: typeof Gavel
  accentKey: keyof typeof BUYER_TILE_ACCENTS
}

/** Bande 02 — univers Affisell (enchères, luxe, vitrines, support, wishlist). */
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
      href: PUBLIC_SHOPS_PATH,
      label: t("stores"),
      hint: t("storesHint"),
      Icon: Store,
      accentKey: "stores",
    },
    {
      href: "/support",
      label: t("support"),
      hint: t("supportHint"),
      Icon: Bot,
      accentKey: "support",
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
      <div className="relative mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/90">
            <span className="inline-flex size-5 items-center justify-center rounded-md border border-white/25 bg-white/10 text-[9px] font-bold text-violet-100">
              02
            </span>
            {tRail("eyebrow")}
          </p>
          <h2 id="home-orbital-rail-heading" className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
            {tRail("title")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-violet-100/85">{tRail("subtitle")}</p>
        </div>
        <Link
          href="/discover"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur-md transition hover:border-white/35 hover:bg-white/15 hover:text-white"
        >
          {t("discover")}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div
        className="relative grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5"
      >
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
