"use client"

import { FastLink } from "@/components/navigation/fast-link"
import { CategoryTree } from "@/components/layout/CategoryTree"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { ThemeToggle } from "@/components/marketing/theme-toggle"
import { startTransition, useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  Brain,
  Crown,
  Gavel,
  Heart,
  Menu,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"

import { MOBILE_BUYER_HUB_OPEN_EVENT } from "@/lib/buyer-hub-events"
import { buyerHaptic } from "@/lib/buyer-haptics"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"
import { loginCustomerPath, MARKETPLACE_BUYER_ORDERS_PATH } from "@/lib/login-redirect"
import { MobileSheetBodySkeleton } from "@/components/marketplace/mobile-sheet-body-skeleton"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useDeferredMount } from "@/hooks/use-deferred-mount"
import { usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type HubTab = "categories" | "hub"

type HubTile = {
  href: string
  label: string
  hint: string
  Icon: typeof Brain
  cardClass: string
  liveLabel?: string
}

/** Global ☰ drawer — Catégories tree + Hub Affisell (mobile buyer shell). */
export function MobileBuyerHub() {
  const t = useTranslations("home.buyerServices")
  const tPulse = useTranslations("pulse")
  const tHub = useTranslations("marketplace.mobileHub")
  const tNav = useTranslations("PublicNav")
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const isCustomer = session?.user?.role === "CUSTOMER"
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<HubTab>("categories")
  const bodyReady = useDeferredMount(open)

  const isBuyerContext =
    pathname === "/track-order" || pathname.startsWith("/marketplace/account")
  const accountHref =
    status !== "loading" && isCustomer
      ? "/marketplace/account"
      : isBuyerContext
        ? loginCustomerPath(MARKETPLACE_BUYER_ORDERS_PATH)
        : "/login"

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
        className="z-[300] flex w-[min(100vw-1.25rem,22.5rem)] flex-col border-white/10 bg-zinc-950 p-0 text-zinc-100"
      >
        <h2 className="sr-only">{tHub("title")}</h2>

        <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-br from-violet-950 via-zinc-950 to-indigo-950 px-4 pb-3 pt-4">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(139,92,246,0.35),transparent)]"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
                <Menu className="size-3.5" aria-hidden />
                Affisell
              </p>
              <p className="mt-1 text-lg font-bold tracking-tight text-white">{tHub("drawerTitle")}</p>
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

          <div
            className="relative mt-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-black/30 p-1"
            role="tablist"
            aria-label={tHub("tabsAria")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "categories"}
              onClick={() => setActiveTab("categories")}
              className={cn(
                "rounded-xl px-3 py-2.5 text-xs font-bold tracking-wide transition",
                activeTab === "categories"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              {tHub("tabCategories")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "hub"}
              onClick={() => setActiveTab("hub")}
              className={cn(
                "rounded-xl px-3 py-2.5 text-xs font-bold tracking-wide transition",
                activeTab === "hub"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              {tHub("tabHub")}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {bodyReady ? (
            activeTab === "categories" ? (
              <div role="tabpanel">
                <CategoryTree onNavigate={closeHub} />
              </div>
            ) : (
              <div role="tabpanel">
                <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t("sectionBuyer")}
                </p>
                <ul className="grid grid-cols-2 gap-2.5">
                  {tiles.map(({ href, label, hint, Icon, cardClass, liveLabel }) => (
                    <li key={href + label}>
                      <FastLink
                        href={href}
                        onClick={closeHub}
                        className={cn(
                          "relative flex min-h-[5.75rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-3 shadow-lg shadow-black/30 transition active:scale-[0.98]",
                          cardClass
                        )}
                      >
                        <span
                          className="pointer-events-none absolute -right-4 -top-4 size-16 rounded-full bg-white/10 blur-2xl"
                          aria-hidden
                        />
                        <span className="relative flex items-start justify-between gap-1">
                          <span className="flex size-8 items-center justify-center rounded-xl bg-black/20 backdrop-blur-sm">
                            <Icon className="size-4 shrink-0 text-white/95" aria-hidden />
                          </span>
                          {liveLabel ? (
                            <span className="rounded-full bg-red-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-md shadow-red-500/40">
                              {liveLabel}
                            </span>
                          ) : null}
                        </span>
                        <span className="relative">
                          <span className="block text-xs font-bold leading-tight text-white">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-[10px] leading-snug text-white/80">
                            {hint}
                          </span>
                        </span>
                      </FastLink>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : (
            <MobileSheetBodySkeleton />
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-zinc-950/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="flex items-start gap-2 text-[10px] leading-snug text-zinc-400">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden />
            <span>{tNav("trustStripText")}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ThemeToggle className="!h-9 !w-auto rounded-full border border-white/10 bg-white/5 px-2.5 text-zinc-200 hover:bg-white/10" />
            <FastLink
              href={accountHref}
              onClick={closeHub}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              <User className="size-3.5 shrink-0" aria-hidden />
              {tNav("myAccount")}
            </FastLink>
            <div className="min-w-0">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
