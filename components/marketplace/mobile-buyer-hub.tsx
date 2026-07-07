"use client"

import { FastLink } from "@/components/navigation/fast-link"
import { startTransition, useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  Brain,
  Crown,
  Gavel,
  Heart,
  LayoutGrid,
  Menu,
  Sparkles,
  Store,
  X,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { MOBILE_BUYER_HUB_OPEN_EVENT } from "@/lib/buyer-hub-events"
import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { buyerHaptic } from "@/lib/buyer-haptics"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import { MobileSheetBodySkeleton } from "@/components/marketplace/mobile-sheet-body-skeleton"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useDeferredMount } from "@/hooks/use-deferred-mount"
import { cn } from "@/lib/utils"

type HubTile = {
  href: string
  label: string
  hint: string
  Icon: typeof Brain
  cardClass: string
  liveLabel?: string
}

/** Global ☰ drawer — services, Pulse, Luxe, support (mobile buyer shell). */
export function MobileBuyerHub() {
  const t = useTranslations("home.buyerServices")
  const tPulse = useTranslations("pulse")
  const tHub = useTranslations("marketplace.mobileHub")
  const [open, setOpen] = useState(false)
  const bodyReady = useDeferredMount(open)

  useEffect(() => {
    const onOpen = () => {
      buyerHaptic("tap")
      startTransition(() => setOpen(true))
    }
    window.addEventListener(MOBILE_BUYER_HUB_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(MOBILE_BUYER_HUB_OPEN_EVENT, onOpen)
  }, [])

  const tiles: HubTile[] = useMemo(
    () => [
    {
      href: "/agent",
      label: t("agent"),
      hint: t("agentHint"),
      Icon: Brain,
      cardClass: BUYER_TILE_ACCENTS.agent.card,
    },
    {
      href: "/discover",
      label: t("discover"),
      hint: t("discoverMarketHint"),
      Icon: Sparkles,
      cardClass: BUYER_TILE_ACCENTS.pulse.card,
      liveLabel: tPulse("beta"),
    },
    {
      href: "/auctions",
      label: t("auctions"),
      hint: t("auctionsHint"),
      Icon: Gavel,
      cardClass: BUYER_TILE_ACCENTS.auctions.card,
    },
    {
      href: "/luxe",
      label: t("luxe"),
      hint: t("luxeHint"),
      Icon: Crown,
      cardClass: BUYER_TILE_ACCENTS.luxe.card,
    },
    {
      href: "/#explorer",
      label: t("catalog"),
      hint: t("catalogHint"),
      Icon: LayoutGrid,
      cardClass: BUYER_TILE_ACCENTS.catalog.card,
    },
    {
      href: PUBLIC_SHOPS_PATH,
      label: t("stores"),
      hint: t("storesHint"),
      Icon: Store,
      cardClass: BUYER_TILE_ACCENTS.stores.card,
    },
    {
      href: "/wishlist",
      label: t("wishlist"),
      hint: t("wishlistHint"),
      Icon: Heart,
      cardClass: BUYER_TILE_ACCENTS.wishlist.card,
    },
    {
      href: "/support",
      label: t("support"),
      hint: t("supportHint"),
      Icon: Bot,
      cardClass: BUYER_TILE_ACCENTS.support.card,
    },
  ],
    [t, tPulse]
  )

  const closeHub = useCallback(() => setOpen(false), [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-[min(100vw-2rem,22rem)] border-white/10 bg-zinc-950 p-0 text-zinc-100"
      >
        <h2 className="sr-only">{tHub("title")}</h2>
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-violet-950 via-zinc-950 to-indigo-950 px-4 py-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(139,92,246,0.35),transparent)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
                <Menu className="size-3.5" aria-hidden />
                Affisell
              </p>
              <p className="mt-1 text-lg font-bold text-white">{tHub("title")}</p>
              <p className="mt-1 text-xs text-zinc-400">{tHub("subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={closeHub}
              className="affisell-inp-tap rounded-full border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label={tHub("close")}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain px-3 py-4">
          {bodyReady ? (
            <>
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("sectionBuyer")}
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {tiles.map(({ href, label, hint, Icon, cardClass, liveLabel }) => (
              <li key={href + label}>
                <FastLink
                  href={href}
                  onClick={closeHub}
                  className={cn(
                    "flex min-h-[5.5rem] flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br p-3 shadow-lg shadow-black/30 transition active:scale-[0.98]",
                    cardClass
                  )}
                >
                  <span className="flex items-start justify-between gap-1">
                    <Icon className="size-4 shrink-0 text-white/95" aria-hidden />
                    {liveLabel ? (
                      <span className="rounded-full bg-red-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                        {liveLabel}
                      </span>
                    ) : null}
                  </span>
                  <span>
                    <span className="block text-xs font-bold leading-tight text-white">{label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-white/80">{hint}</span>
                  </span>
                </FastLink>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 px-3 py-3">
            <p className="text-xs font-semibold text-violet-200">{tHub("desktopHintTitle")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{tHub("desktopHintBody")}</p>
          </div>
            </>
          ) : (
            <MobileSheetBodySkeleton />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
