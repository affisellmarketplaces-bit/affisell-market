"use client"

import Link from "next/link"
import { ArrowLeft, Sparkles } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { HomePersonalizedPicksRailLive } from "@/components/home/home-personalized-picks-rail-live"
import {
  BuyerSwipeCard,
  type BuyerSwipeCardHandle,
  type BuyerSwipeDirection,
} from "@/components/pulse/buyer-swipe-card"
import { SwipeCommerceDock } from "@/components/pulse/swipe-commerce-dock"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { PulseHeaderCartLink } from "@/components/pulse/pulse-header-cart-link"
import { PulseBattleBanner } from "@/components/pulse/PulseBattleBanner"
import { PulseBattleHeaderLink } from "@/components/pulse/PulseBattleHeaderLink"
import { PulseLayoutModeLink } from "@/components/pulse/pulse-layout-mode-link"
import { PulseProductDetailPanel } from "@/components/pulse/pulse-product-detail-panel"
import { addToBuyerCart } from "@/lib/cart-add-client"
import { useBuyNowWithIdentity } from "@/hooks/use-buy-now-with-identity"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"
import { fetchBuyerSessionSnapshot } from "@/lib/buyer-session-client"
import { toggleProductWishlist } from "@/lib/wishlist-toggle-client"
import { requestPriceAlertPushSubscription } from "@/components/push/request-price-alert-push"
import {
  consumePendingPricePushAfterLogin,
  markPendingPricePushAfterLogin,
} from "@/lib/wishlist-push-nudge.client"
import { affisellBrand } from "@/lib/affisell-brand"
import { notifyBuyerPersonalizationRefresh } from "@/lib/buyer-personalization-refresh.client"
import { discoverSwipeHref } from "@/lib/discover-swipe-url"
import { pulseSwipeHaptic } from "@/lib/pulse-swipe-haptics"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import { cn } from "@/lib/utils"

const STACK_VISIBLE = 2
const PREFETCH_WHEN_LEFT = 4

function shuffleItems(items: PulseFeedItem[]): PulseFeedItem[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = next[i]
    next[i] = next[j]!
    next[j] = tmp!
  }
  return next
}

function buildFeedQuery(
  categoryId: string | null,
  subcategoryId: string | null,
  take: number
): string {
  const params = new URLSearchParams()
  params.set("take", String(take))
  if (categoryId) params.set("category", categoryId)
  if (subcategoryId) params.set("subcategory", subcategoryId)
  return params.toString()
}

type Props = {
  initialItems: PulseFeedItem[]
  categoryId?: string | null
  subcategoryId?: string | null
  categoryLabel?: string | null
  initialPersonalizedPicks?: BuyerPersonalizedPicksPayload
}

export function BuyerSwipeCommerce({
  initialItems,
  categoryId = null,
  subcategoryId = null,
  categoryLabel = null,
  initialPersonalizedPicks,
}: Props) {
  const t = useTranslations("pulse.commerce")
  const tPulse = useTranslations("pulse")
  const pathname = usePathname()
  const { push: navigate, replace, prefetch, mounted } = useSafeAppRouter()
  const searchParams = useSearchParams()
  const { buyNow: buyNowWithIdentity, identitySheet } = useBuyNowWithIdentity()

  const [deck, setDeck] = useState<PulseFeedItem[]>(() =>
    initialItems.filter((i) => i.mediaUrl && i.listingId)
  )
  const [loading, setLoading] = useState(false)
  const [feedExhausted, setFeedExhausted] = useState(initialItems.length === 0)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [skippedPool, setSkippedPool] = useState<PulseFeedItem[]>([])
  const [replayMode, setReplayMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dragGlow, setDragGlow] = useState({ x: 0, y: 0 })

  const fetchingRef = useRef(false)
  const fetchErrorToastShownRef = useRef(false)
  const rewindAnnouncedRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)
  const lastToastRef = useRef<{ msg: string; at: number } | null>(null)
  const deckRef = useRef(deck)
  const topCardRef = useRef<BuyerSwipeCardHandle>(null)
  deckRef.current = deck

  const showToast = useCallback((msg: string, opts?: { force?: boolean }) => {
    const now = Date.now()
    const last = lastToastRef.current
    if (
      !opts?.force &&
      last &&
      (last.msg === msg || now - last.at < 2400)
    ) {
      return
    }
    lastToastRef.current = { msg, at: now }
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 2600)
  }, [])

  const fetchMore = useCallback(
    async (replace = false) => {
      if (fetchingRef.current) return
      fetchingRef.current = true
      setLoading(true)
      setFetchError(null)
      try {
        const qs = buildFeedQuery(categoryId, subcategoryId, 24)
        const res = await fetch(`/api/buyer/swipe-feed?${qs}`, { cache: "no-store" })
        const data = (await res.json().catch(() => ({}))) as {
          products?: PulseFeedItem[]
          error?: string
        }
        if (!res.ok) {
          const msg = data.error ?? t("feedLoadFailed")
          setFetchError(msg)
          setFeedExhausted(true)
          if (!fetchErrorToastShownRef.current) {
            fetchErrorToastShownRef.current = true
            showToast(msg, { force: true })
          }
          return
        }
        setFetchError(null)
        fetchErrorToastShownRef.current = false
        const incoming = (data.products ?? []).filter((p) => p.mediaUrl && p.listingId)
        if (incoming.length === 0) setFeedExhausted(true)
        else if (replace) {
          setFeedExhausted(false)
          setReplayMode(false)
          rewindAnnouncedRef.current = false
        }
        setDeck((prev) => {
          if (replace) return incoming
          const seen = new Set(prev.map((p) => p.id))
          const merged = [...prev]
          for (const p of incoming) {
            if (!seen.has(p.id)) merged.push(p)
          }
          return merged
        })
      } catch {
        setFetchError(t("feedLoadFailed"))
        setFeedExhausted(true)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    },
    [categoryId, subcategoryId, showToast]
  )

  useEffect(() => {
    if (deck.length === 0 && initialItems.length > 0) {
      setDeck(initialItems.filter((i) => i.mediaUrl && i.listingId))
      setFeedExhausted(false)
    }
  }, [initialItems, deck.length])

  useEffect(() => {
    if (!mounted || searchParams.get("success") !== "true") return
    notifyBuyerPersonalizationRefresh("checkout_success")
    const next = new URLSearchParams(searchParams.toString())
    next.delete("success")
    const href = next.toString() ? `${pathname}?${next.toString()}` : pathname
    replace(href, { scroll: false })
  }, [mounted, pathname, replace, searchParams])

  useEffect(() => {
    if (feedExhausted || loading || deck.length > PREFETCH_WHEN_LEFT) return
    void fetchMore(false)
  }, [deck.length, feedExhausted, loading, fetchMore])

  useEffect(() => {
    if (loading || busy) return
    if (!feedExhausted || deck.length > 0) return
    if (skippedPool.length === 0) return
    if (rewindAnnouncedRef.current) return
    rewindAnnouncedRef.current = true
    setReplayMode(true)
    setFeedExhausted(false)
    setDeck(shuffleItems(skippedPool))
    showToast(t("rewindOn"), { force: true })
  }, [loading, busy, feedExhausted, deck.length, skippedPool, showToast, t])

  const visibleStack = useMemo(() => deck.slice(0, STACK_VISIBLE), [deck])
  const activeItem = deck[0] ?? null

  const recordView = useCallback((item: PulseFeedItem) => {
    void fetch("/api/pulse/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: item.source,
        productId: item.productId || undefined,
      }),
    })
  }, [])

  useEffect(() => {
    const top = deck[0]
    if (top) recordView(top)
  }, [deck, recordView])

  const addToCart = useCallback(
    async (item: PulseFeedItem) => {
      if (!item.listingId) return
      const result = await addToBuyerCart({
        productId: item.listingId,
        qty: 1,
        title: item.title,
        price: item.priceCents / 100,
        imageUrl: item.mediaUrl,
      })
      if (result.ok) {
        console.log("[buyer-swipe-commerce]", { listingId: item.listingId, result: "cart" })
        showToast(t("cartAdded"))
      }
    },
    [showToast, t]
  )

  useEffect(() => {
    void consumePendingPricePushAfterLogin().then((result) => {
      if (result === "granted") showToast(t("saveDropPushEnabled"), { force: true })
    })
  }, [showToast, t])

  const saveDrop = useCallback(
    async (item: PulseFeedItem) => {
      if (!item.productId) return
      const targetPriceEur = Math.max(0.01, Math.round(item.priceCents * 0.95) / 100)
      const result = await toggleProductWishlist(item.productId, { targetPriceEur })
      if (result.ok) {
        console.log("[buyer-swipe-commerce]", {
          productId: item.productId,
          result: "save-drop",
          wished: result.wished,
        })
        showToast(t("saveDrop"))
        if (result.wished) {
          const session = await fetchBuyerSessionSnapshot()
          if (!session.userId) {
            markPendingPricePushAfterLogin()
            showToast(t("saveDropLoginForPush"), { force: true })
            const qs = searchParams.toString()
            const callbackUrl = `${pathname}${qs ? `?${qs}` : ""}`
            navigate(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
            return
          }
          const pushPermission = await requestPriceAlertPushSubscription()
          if (pushPermission === "granted") {
            showToast(t("saveDropPushEnabled"))
          }
        }
      }
    },
    [navigate, pathname, searchParams, showToast, t]
  )

  const buyNow = useCallback(
    async (item: PulseFeedItem) => {
      if (!item.listingId) return
      await buyNowWithIdentity(
        {
          productId: item.listingId,
          qty: 1,
          successPath: "/discover?success=true",
          cancelPath: discoverSwipeHref({ category: categoryId, subcategory: subcategoryId }),
        },
        {
          productId: item.listingId,
          title: item.title,
          price: item.priceCents / 100,
          imageUrl: item.mediaUrl,
        }
      )
    },
    [categoryId, subcategoryId, buyNowWithIdentity]
  )

  const advanceDeck = useCallback((productId: string) => {
    setDeck((d) => d.filter((p) => p.id !== productId))
  }, [])

  const commitSwipe = useCallback(
    async (direction: BuyerSwipeDirection) => {
      const item = deckRef.current[0]
      if (!item) return

      pulseSwipeHaptic(direction === "right" ? "commit" : "tap")
      setBusy(true)
      setDragGlow({ x: 0, y: 0 })

      try {
        if (direction === "up") {
          await addToCart(item)
        } else if (direction === "down") {
          await saveDrop(item)
          setSkippedPool((pool) => (pool.some((p) => p.id === item.id) ? pool : [...pool, item]))
        } else if (direction === "right") {
          await buyNow(item)
        } else {
          setSkippedPool((pool) => (pool.some((p) => p.id === item.id) ? pool : [...pool, item]))
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : t("genericError"))
        topCardRef.current?.reset()
        setBusy(false)
        return
      }

      advanceDeck(item.id)
      setBusy(false)
    },
    [addToCart, advanceDeck, buyNow, saveDrop, showToast, t]
  )

  const handleUndo = useCallback(() => {
    const last = skippedPool[skippedPool.length - 1]
    if (!last || busy) return
    pulseSwipeHaptic("undo")
    setSkippedPool((pool) => pool.slice(0, -1))
    setDeck((d) => [last, ...d.filter((p) => p.id !== last.id)])
    showToast(t("undo"))
  }, [busy, skippedPool, showToast, t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (busy || deckRef.current.length === 0) return
      if (e.key === "ArrowUp") void commitSwipe("up")
      if (e.key === "ArrowDown") void commitSwipe("down")
      if (e.key === "ArrowRight") void commitSwipe("right")
      if (e.key === "ArrowLeft") void commitSwipe("left")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, commitSwipe])

  const exitHref = categoryId
    ? `/?category=${encodeURIComponent(categoryId)}#explorer`
    : "/#explorer"

  const scrollHref = discoverSwipeHref({
    category: categoryId,
    subcategory: subcategoryId,
    layout: "scroll",
  })

  useEffect(() => {
    if (!mounted) return
    prefetch(scrollHref)
  }, [mounted, prefetch, scrollHref])

  if (deck.length === 0 && !loading && feedExhausted && skippedPool.length === 0) {
    return (
      <div
        data-testid="affisell-pulse"
        className={cn(
          affisellBrand.epoxyPage,
          "relative flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center"
        )}
      >
        <div className={affisellBrand.epoxyCanvas} aria-hidden />
        <div className={cn(affisellBrand.epoxyPanel, "relative z-10 max-w-sm p-8")}>
        <Sparkles className="mx-auto mb-4 size-12 text-violet-300" aria-hidden />
        <p className="text-lg font-semibold">{tPulse("emptyTitle")}</p>
        <p className="mt-2 text-sm text-zinc-300">
          {categoryLabel ? t("emptyCategory", { name: categoryLabel }) : tPulse("emptyBody")}
        </p>
        <Link
          href={exitHref}
          className={cn(
            affisellBrand.epoxyCta,
            "mt-6 inline-flex rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold"
          )}
        >
          {tPulse("browseCatalog")}
        </Link>
        </div>
      </div>
    )
  }

  const activePriceEur = activeItem ? activeItem.priceCents / 100 : 0
  const activeCompareEur =
    activeItem?.compareAtCents != null ? activeItem.compareAtCents / 100 : null

  const showPicks = !categoryId && !subcategoryId && Boolean(initialPersonalizedPicks)

  return (
    <div
      data-testid="affisell-pulse"
      className={cn(
        affisellBrand.epoxyPage,
        "affisell-swipe-commerce affisell-swipe-commerce--desktop fixed inset-0 z-[210] flex h-screen h-[100dvh] flex-col overflow-hidden",
        showPicks && "affisell-swipe-commerce--with-picks"
      )}
    >
      <div className={affisellBrand.epoxyCanvas} aria-hidden />
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-emerald-500/20 blur-[100px]"
          animate={{ opacity: [0.3, 0.55, 0.3] }}
          style={{ scale: 1 + Math.max(0, -dragGlow.y) * 0.12 }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute -right-16 bottom-24 h-80 w-80 rounded-full bg-violet-600/25 blur-[90px]"
          style={{ scale: 1 + Math.max(0, dragGlow.x) * 0.12 }}
        />
        <motion.div
          className="absolute left-1/2 bottom-0 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-500/15 blur-[80px]"
          style={{ scale: 1 + Math.max(0, dragGlow.y) * 0.12 }}
        />
      </div>

      <header className="affisell-swipe-header relative z-40 shrink-0 px-2 pb-0.5 pt-[max(0.35rem,env(safe-area-inset-top))] sm:px-3 sm:pb-2 sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
        <PulseBattleBanner className="-mx-2 mb-1 sm:-mx-3" />
        {fetchError ? (
          <p
            role="alert"
            className={cn(
              affisellBrand.epoxyChip,
              "mx-auto mb-1 max-w-[420px] rounded-xl px-2.5 py-1.5 text-center text-[11px] text-amber-100 sm:mb-2 sm:px-3 sm:py-2 sm:text-xs lg:max-w-7xl"
            )}
          >
            {fetchError}
          </p>
        ) : null}
        <div
          className={cn(
            affisellBrand.epoxyPanel,
            "mx-auto flex h-11 max-w-[420px] items-center justify-between gap-1.5 px-1.5 sm:h-auto sm:gap-2 sm:px-3 sm:py-2 lg:max-w-7xl"
          )}
        >
          <Link
            href={exitHref}
            aria-label={tPulse("exit")}
            className={cn(
              affisellBrand.epoxyChip,
              "flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 sm:size-auto sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs"
            )}
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">{tPulse("exit")}</span>
          </Link>

          <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-1">
            <div className="flex max-w-full items-center justify-center gap-1.5">
              <span
                className={cn(
                  affisellBrand.brandWordmark,
                  "truncate text-[13px] leading-none sm:text-sm"
                )}
              >
                {tPulse("brand")}
              </span>
              <span
                className={cn(
                  affisellBrand.epoxyChip,
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none text-red-100"
                )}
              >
                {tPulse("beta")}
              </span>
              {replayMode ? (
                <span
                  className={cn(
                    affisellBrand.epoxyChip,
                    "hidden shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase text-violet-100 sm:inline-flex"
                  )}
                >
                  {t("rewindBadge")}
                </span>
              ) : null}
            </div>
            {categoryLabel ? (
              <p className="mt-0.5 hidden max-w-[12rem] truncate text-[10px] text-zinc-400 sm:block">
                {categoryLabel}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <PulseBattleHeaderLink className="hidden sm:inline-flex" />
            <LanguageSwitcher className="hidden shrink-0 sm:block [&_button]:border-white/15 [&_button]:bg-black/40 [&_button]:text-white" />
            <PulseLayoutModeLink
              target="scroll"
              label={t("scrollModeShort")}
              categoryId={categoryId}
              subcategoryId={subcategoryId}
              className="!size-9 !justify-center !gap-0 !px-0 sm:!size-auto sm:!gap-1.5 sm:!px-2.5 [&_span]:hidden sm:[&_span]:inline"
            />
            <PulseHeaderCartLink />
            <span
              className={cn(
                affisellBrand.epoxyChip,
                "hidden tabular-nums rounded-full px-2 py-1 text-xs text-white/80 sm:inline-flex"
              )}
            >
              {deck.length > 0 ? deck.length : "—"}
            </span>
          </div>
        </div>
      </header>

      {showPicks && initialPersonalizedPicks ? (
        <div className="affisell-swipe-picks relative z-30 mx-auto w-full max-w-[420px] shrink-0 px-2 sm:px-3 lg:max-w-7xl">
          <HomePersonalizedPicksRailLive
            initialPicks={initialPersonalizedPicks}
            variant="pulse"
          />
        </div>
      ) : null}

      <div className="affisell-swipe-body flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-7xl lg:px-6">
        <div className="affisell-swipe-desktop-grid flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-stretch lg:gap-8">
      <main className="affisell-swipe-stage relative z-10 flex min-h-0 flex-1 flex-col px-2 pb-0 sm:px-3 sm:pb-2 lg:min-h-0 lg:px-0">
        <div className="affisell-swipe-card-well relative mx-auto min-h-0 w-full max-w-[380px] flex-1 lg:max-h-[min(72vh,720px)] lg:max-w-none">
          <AnimatePresence mode="popLayout">
            {visibleStack.length === 0 && loading ? (
              <motion.div
                key="loading"
                className="flex h-full min-h-[10rem] items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="size-10 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400" />
              </motion.div>
            ) : (
              visibleStack.map((item, i) => (
                <BuyerSwipeCard
                  key={item.id}
                  ref={i === 0 ? topCardRef : undefined}
                  item={item}
                  stackIndex={i}
                  isTop={i === 0 && !busy}
                  onSwipeComplete={commitSwipe}
                  onDragProgress={i === 0 ? setDragGlow : undefined}
                />
              ))
            )}
          </AnimatePresence>

          {activeItem ? (
            <div className="affisell-swipe-commerce-ribbon pointer-events-none absolute inset-x-0 bottom-0 z-40 max-sm:pb-0 lg:hidden">
              <div className="pointer-events-auto px-2.5 pb-2 pt-10 sm:px-3 sm:pb-2.5 sm:pt-12">
                <PulseProductDetailPanel
                  item={activeItem}
                  priceEur={activePriceEur}
                  compareEur={activeCompareEur}
                  variant="ribbon"
                />
              </div>
            </div>
          ) : null}
        </div>

        <SwipeCommerceDock
          busy={busy}
          deckEmpty={deck.length === 0}
          canUndo={skippedPool.length > 0}
          onSwipe={(direction) => {
            if (busy || deck.length === 0) return
            topCardRef.current?.swipe(direction)
          }}
          onUndo={handleUndo}
        />
      </main>

      {activeItem ? (
        <aside
          className="affisell-swipe-detail-panel relative z-20 hidden min-h-0 lg:flex lg:flex-col lg:justify-center lg:py-4"
          aria-label={t("viewDetails")}
        >
          <div
            className={cn(
              affisellBrand.epoxyPanel,
              "affisell-swipe-detail-panel-inner overflow-y-auto overscroll-contain p-6 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12),0_24px_64px_rgb(5_8_22_/_0.55)]"
            )}
          >
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/80">
              {tPulse("brand")}
            </p>
            <PulseProductDetailPanel
              item={activeItem}
              priceEur={activePriceEur}
              compareEur={activeCompareEur}
              variant="desktop"
            />
          </div>
        </aside>
      ) : null}
        </div>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              affisellBrand.epoxyToast,
              "affisell-swipe-toast fixed left-1/2 z-[160] max-w-[90vw] -translate-x-1/2"
            )}
            role="status"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
      {identitySheet}
    </div>
  )
}
