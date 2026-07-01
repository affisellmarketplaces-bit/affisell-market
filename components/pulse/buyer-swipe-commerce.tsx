"use client"

import Link from "next/link"
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import {
  BuyerSwipeCard,
  type BuyerSwipeCardHandle,
  type BuyerSwipeDirection,
} from "@/components/pulse/buyer-swipe-card"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { PulseHeaderCartLink } from "@/components/pulse/pulse-header-cart-link"
import { PulseLayoutModeLink } from "@/components/pulse/pulse-layout-mode-link"
import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { addToBuyerCart } from "@/lib/cart-add-client"
import { useBuyNowWithIdentity } from "@/hooks/use-buy-now-with-identity"
import { toggleProductWishlist } from "@/lib/wishlist-toggle-client"
import { affisellBrand } from "@/lib/affisell-brand"
import { discoverSwipeHref } from "@/lib/discover-swipe-url"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import { cn } from "@/lib/utils"

const STACK_VISIBLE = 3
const PREFETCH_WHEN_LEFT = 4

type SwipeDockDirection = "up" | "left" | "right" | "down"

const SWIPE_DOCK_DIRECTION_GLYPH: Record<SwipeDockDirection, string> = {
  up: "↑",
  left: "←",
  right: "→",
  down: "↓",
}

function SwipeDockActionLabel({
  direction,
  children,
}: {
  direction?: SwipeDockDirection
  children: ReactNode
}) {
  return (
    <span className="flex flex-col items-center gap-0.5 leading-none">
      {direction ? (
        <span
          className="text-[11px] font-black leading-none opacity-95 sm:hidden"
          aria-hidden
        >
          {SWIPE_DOCK_DIRECTION_GLYPH[direction]}
        </span>
      ) : null}
      <span className="text-[8px] font-semibold uppercase tracking-[0.08em] sm:text-[10px]">
        {children}
      </span>
    </span>
  )
}

const SWIPE_DOCK_BTN_MOBILE =
  "max-sm:min-h-[3.35rem] max-sm:justify-center max-sm:gap-1 max-sm:py-1.5 max-sm:px-0.5"

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
}

export function BuyerSwipeCommerce({
  initialItems,
  categoryId = null,
  subcategoryId = null,
  categoryLabel = null,
}: Props) {
  const t = useTranslations("pulse.commerce")
  const tPulse = useTranslations("pulse")
  const router = useRouter()
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

  const saveDrop = useCallback(
    async (item: PulseFeedItem) => {
      if (!item.productId) return
      const result = await toggleProductWishlist(item.productId)
      if (result.ok) {
        console.log("[buyer-swipe-commerce]", {
          productId: item.productId,
          result: "save-drop",
          wished: result.wished,
        })
        showToast(t("saveDrop"))
      }
    },
    [showToast, t]
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
      if (!item || busy) return

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
    [addToCart, advanceDeck, busy, buyNow, saveDrop, showToast]
  )

  const requestSwipe = useCallback(
    (direction: BuyerSwipeDirection) => {
      if (busy || deckRef.current.length === 0) return
      topCardRef.current?.swipe(direction)
    },
    [busy]
  )

  const handleUndo = useCallback(() => {
    const last = skippedPool[skippedPool.length - 1]
    if (!last || busy) return
    setSkippedPool((pool) => pool.slice(0, -1))
    setDeck((d) => [last, ...d.filter((p) => p.id !== last.id)])
    showToast(t("undo"))
  }, [busy, skippedPool, showToast, t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowUp") requestSwipe("up")
      if (e.key === "ArrowDown") requestSwipe("down")
      if (e.key === "ArrowRight") requestSwipe("right")
      if (e.key === "ArrowLeft") requestSwipe("left")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [requestSwipe])

  const exitHref = categoryId
    ? `/?category=${encodeURIComponent(categoryId)}#explorer`
    : "/#explorer"

  const scrollHref = discoverSwipeHref({
    category: categoryId,
    subcategory: subcategoryId,
    layout: "scroll",
  })

  useEffect(() => {
    router.prefetch(scrollHref)
  }, [router, scrollHref])

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

  return (
    <div
      data-testid="affisell-pulse"
      className={cn(
        affisellBrand.epoxyPage,
        "affisell-swipe-commerce fixed inset-0 z-[140] flex flex-col"
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

      <header className="affisell-swipe-header relative z-40 shrink-0 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3 sm:pb-2 sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
        {fetchError ? (
          <p
            role="alert"
            className={cn(
              affisellBrand.epoxyChip,
              "mx-auto mb-1.5 max-w-[420px] rounded-xl px-2.5 py-1.5 text-center text-[11px] text-amber-100 sm:mb-2 sm:px-3 sm:py-2 sm:text-xs"
            )}
          >
            {fetchError}
          </p>
        ) : null}
        <div
          className={cn(
            affisellBrand.epoxyPanel,
            "mx-auto flex max-w-[420px] items-center justify-between gap-1 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2"
          )}
        >
          <Link
            href={exitHref}
            className={cn(
              affisellBrand.epoxyChip,
              "flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-white/90 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs"
            )}
          >
            <ArrowLeft className="size-3.5 sm:size-4" aria-hidden />
            <span className="hidden sm:inline">{tPulse("exit")}</span>
          </Link>
          <div className="flex min-w-0 flex-col items-center">
            <span className={cn(affisellBrand.brandWordmark, "text-[13px] sm:text-sm")}>{tPulse("brand")}</span>
            <span className="mt-0.5 flex items-center gap-1 sm:mt-1 sm:gap-1.5">
              <span
                className={cn(
                  affisellBrand.epoxyChip,
                  "rounded-full px-1.5 py-px text-[8px] font-bold uppercase text-red-100 sm:py-0.5 sm:text-[9px]"
                )}
              >
                {tPulse("beta")}
              </span>
              {replayMode ? (
                <span
                  className={cn(
                    affisellBrand.epoxyChip,
                    "rounded-full px-1.5 py-px text-[8px] font-bold uppercase text-violet-100 sm:py-0.5 sm:text-[9px]"
                  )}
                >
                  {t("rewindBadge")}
                </span>
              ) : null}
            </span>
            {categoryLabel ? (
              <p className="mt-0.5 hidden max-w-[12rem] truncate text-[10px] text-zinc-400 sm:block">
                {categoryLabel}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
            <LanguageSwitcher className="shrink-0 scale-[0.88] sm:scale-100 [&_button]:border-white/15 [&_button]:bg-black/40 [&_button]:text-white" />
            <PulseLayoutModeLink
              target="scroll"
              label={t("scrollModeShort")}
              categoryId={categoryId}
              subcategoryId={subcategoryId}
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

      <main className="affisell-swipe-stage relative z-10 flex min-h-0 flex-1 flex-col px-2 pb-1 sm:px-3 sm:pb-2">
        <div className="relative mx-auto min-h-0 w-full max-w-[380px] flex-1">
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
            <div className="affisell-swipe-commerce-ribbon pointer-events-none absolute inset-x-0 bottom-0 z-40">
              <div className="pointer-events-auto px-2.5 pb-2 pt-10 sm:px-3 sm:pb-2.5 sm:pt-12">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {activeItem.boosted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/25 px-1.5 py-px text-[9px] font-bold uppercase text-cyan-100 ring-1 ring-cyan-400/35 backdrop-blur-sm sm:px-2 sm:py-0.5 sm:text-[10px]">
                      <Sparkles className="size-2.5 sm:size-3" aria-hidden />
                      {t("hotBadge")}
                    </span>
                  ) : null}
                  {activeItem.soldCount > 0 ? (
                    <ProductSalesBadge
                      count={activeItem.soldCount}
                      variant="inline"
                      className="!bg-black/35 !text-white !ring-white/20 backdrop-blur-sm"
                    />
                  ) : null}
                </div>
                <h2 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-tight text-white drop-shadow-sm sm:mt-1.5 sm:text-[15px] sm:leading-snug">
                  {activeItem.title}
                </h2>
                {activeItem.priceCents > 0 ? (
                  <div className="mt-0.5 [&_p]:!text-white/75 [&_span]:!text-white sm:mt-1">
                    <ProductPriceOffer
                      price={activePriceEur}
                      compareAt={activeCompareEur}
                      layout="compact"
                    />
                  </div>
                ) : null}
                {activeItem.storeName ? (
                  <p className="mt-0.5 truncate text-[10px] text-white/55 sm:mt-1 sm:text-xs sm:text-zinc-300">
                    {activeItem.storeName}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            affisellBrand.epoxyPanel,
            "affisell-swipe-dock affisell-swipe-dock-panel relative z-50 mx-auto w-full max-w-[380px] shrink-0 px-2 py-2 sm:px-4 sm:py-3"
          )}
        >
          <p className="mb-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:mb-2 sm:text-[10px] sm:tracking-wider">
            {t("hint")}
          </p>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={busy || deck.length === 0}
              onClick={() => requestSwipe("left")}
              className={cn(affisellBrand.epoxyActionBtn, SWIPE_DOCK_BTN_MOBILE)}
              aria-label={t("skip")}
            >
              <ChevronLeft className="size-[18px] sm:size-5" aria-hidden />
              <SwipeDockActionLabel direction="left">{t("skipShort")}</SwipeDockActionLabel>
            </button>
            <button
              type="button"
              disabled={busy || deck.length === 0}
              onClick={() => requestSwipe("up")}
              className={cn(affisellBrand.epoxyActionCart, SWIPE_DOCK_BTN_MOBILE)}
              aria-label={t("cart")}
            >
              <ShoppingBag className="size-[18px] sm:size-5" aria-hidden />
              <SwipeDockActionLabel direction="up">{t("cartShort")}</SwipeDockActionLabel>
            </button>
            <button
              type="button"
              disabled={skippedPool.length === 0 || busy}
              onClick={handleUndo}
              className={cn(affisellBrand.epoxyActionBtn, SWIPE_DOCK_BTN_MOBILE)}
              aria-label={t("undo")}
            >
              <RotateCcw className="size-[18px] sm:size-5" aria-hidden />
              <SwipeDockActionLabel>{t("undoShort")}</SwipeDockActionLabel>
            </button>
            <button
              type="button"
              disabled={busy || deck.length === 0}
              onClick={() => requestSwipe("right")}
              className={cn(affisellBrand.epoxyActionBuy, SWIPE_DOCK_BTN_MOBILE)}
              aria-label={t("buy")}
            >
              <Zap className="size-[18px] sm:size-5" aria-hidden />
              <SwipeDockActionLabel direction="right">{t("buyShort")}</SwipeDockActionLabel>
            </button>
            <button
              type="button"
              disabled={busy || deck.length === 0}
              onClick={() => requestSwipe("down")}
              className={cn(affisellBrand.epoxyActionDrop, SWIPE_DOCK_BTN_MOBILE)}
              aria-label={t("saveDrop")}
            >
              <Bookmark className="size-[18px] sm:size-5" aria-hidden />
              <SwipeDockActionLabel direction="down">{t("saveDropShort")}</SwipeDockActionLabel>
            </button>
          </div>
        </div>
      </main>

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
