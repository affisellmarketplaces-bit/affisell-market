"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Brain, Bot, Crown, Gavel, Heart, LayoutGrid, Sparkles, Store } from "lucide-react"

import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { affisellBrand } from "@/lib/affisell-brand"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import { cn } from "@/lib/utils"

type Props = {
  audience?: "buyer" | "default"
}

/** Affisell service shortcuts — pages catalogue standalone (pas sur home embed). */
export function MarketplaceAffisellPulse({ audience = "default" }: Props) {
  const t = useTranslations("home.buyerServices")
  const tPulse = useTranslations("pulse")

  const buyerTiles = [
    {
      href: "/agent",
      label: t("agent"),
      hint: t("agentHint"),
      Icon: Brain,
      cardClass: `${BUYER_TILE_ACCENTS.agent.card} text-white shadow-violet-500/25`,
    },
    {
      href: "/auctions",
      label: t("auctions"),
      hint: t("auctionsHint"),
      Icon: Gavel,
      cardClass: `${BUYER_TILE_ACCENTS.auctions.card} text-white shadow-violet-500/25`,
    },
    {
      href: "/luxe",
      label: t("luxe"),
      hint: t("luxeHint"),
      Icon: Crown,
      cardClass: `${BUYER_TILE_ACCENTS.luxe.card} text-white shadow-violet-500/25`,
    },
    {
      href: "/discover",
      label: t("discover"),
      liveLabel: tPulse("beta"),
      hint: t("discoverMarketHint"),
      Icon: Sparkles,
      cardClass: `${BUYER_TILE_ACCENTS.pulse.card} text-white shadow-fuchsia-500/25`,
    },
    {
      href: "/#explorer",
      label: t("catalog"),
      hint: t("catalogHint"),
      Icon: LayoutGrid,
      cardClass: `${BUYER_TILE_ACCENTS.catalog.card} text-white shadow-indigo-500/25`,
    },
    {
      href: PUBLIC_SHOPS_PATH,
      label: t("stores"),
      hint: t("storesHint"),
      Icon: Store,
      cardClass: `${BUYER_TILE_ACCENTS.stores.card} text-white shadow-violet-500/25`,
    },
    {
      href: "/support",
      label: t("support"),
      hint: t("supportHint"),
      Icon: Bot,
      cardClass: `${BUYER_TILE_ACCENTS.support.card} text-white shadow-violet-500/25`,
    },
    {
      href: "/wishlist",
      label: t("wishlist"),
      hint: t("wishlistHint"),
      Icon: Heart,
      cardClass: `${BUYER_TILE_ACCENTS.wishlist.card} text-white shadow-fuchsia-500/25`,
    },
  ]

  const defaultTiles = [
    {
      href: "/agent",
      label: t("agent"),
      hint: t("agentHint"),
      className: `${BUYER_TILE_ACCENTS.agent.card} text-white shadow-violet-500/25`,
    },
    {
      href: "/discover",
      label: t("discover"),
      hint: t("discoverHint"),
      className: `${BUYER_TILE_ACCENTS.pulse.card} text-white shadow-fuchsia-500/25`,
    },
    {
      href: "/shops/browse?q=smart",
      label: t("liveSearch"),
      hint: t("liveSearchHint"),
      className: `${BUYER_TILE_ACCENTS.catalog.card} text-white shadow-indigo-500/25`,
    },
    {
      href: "/wishlist",
      label: t("wishlist"),
      hint: t("wishlistHint"),
      className: `${BUYER_TILE_ACCENTS.wishlist.card} text-white shadow-fuchsia-500/25`,
    },
  ]

  if (audience === "buyer") {
    return (
      <section
        className={cn(affisellBrand.epoxySurfaceLight, "mt-4 rounded-2xl p-4")}
        aria-label={t("aria")}
      >
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {t("sectionBuyer")}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {buyerTiles.map(({ href, label, hint, Icon, cardClass, liveLabel }) => (
            <li key={href + label}>
              <Link
                href={href}
                className={cn(
                  "flex min-h-[4.25rem] flex-col justify-center gap-0.5 rounded-xl bg-gradient-to-br px-3 py-2.5 text-sm font-semibold shadow-md transition hover:opacity-95 active:scale-[0.99]",
                  cardClass
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Icon className="size-4 shrink-0 opacity-95" aria-hidden />
                  <span>{label}</span>
                  {liveLabel ? (
                    <span className="rounded-full border border-white/25 bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      {liveLabel}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-normal opacity-90">{hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section
      className="mt-4 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-[#1E1B4B]/5 via-white to-violet-50/40 p-4 shadow-sm dark:border-violet-900/30 dark:from-violet-950/30 dark:via-zinc-950 dark:to-indigo-950/20"
      aria-label={t("aria")}
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600/80 dark:text-violet-300/80">
        {t("sectionDefault")}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {defaultTiles.map(({ href, label, hint, className }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex min-h-[4.25rem] flex-col justify-center gap-0.5 rounded-xl bg-gradient-to-br px-3 py-2.5 text-sm font-semibold shadow-md transition hover:opacity-95 active:scale-[0.99]",
                className
              )}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 shrink-0 opacity-95" aria-hidden />
                {label}
              </span>
              <span className="text-[11px] font-normal opacity-90">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
