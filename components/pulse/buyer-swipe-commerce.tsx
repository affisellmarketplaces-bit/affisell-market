"use client"

import Link from "next/link"
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  Layers,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  BuyerSwipeCard,
  type BuyerSwipeCardHandle,
  type BuyerSwipeDirection,
} from "@/components/pulse/buyer-swipe-card"
import { buttonVariants } from "@/components/ui/button"
import { addGuestCartItem } from "@/lib/guest-cart"
import { affisellBrand } from "@/lib/affisell-brand"
import { discoverSwipeHref } from "@/lib/discover-swipe-url"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import { cn } from "@/lib/utils"

const STACK_VISIBLE = 3
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
  const deckRef = useRef(deck)
  const topCardRef = useRef<BuyerSwipeCardHandle>(null)
  deckRef.current = deck

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
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
          const msg = data.error ?? "Impossible de charger le feed"
          setFetchError(msg)
          setFeedExhausted(true)
          showToast(msg)
          return
        }
        const incoming = (data.products ?? []).filter((p) => p.mediaUrl && p.listingId)
        if (incoming.length === 0) setFeedExhausted(true)
        else if (replace) {
          setFeedExhausted(false)
          setReplayMode(false)
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
        setFetchError("Impossible de charger le feed")
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
    setReplayMode(true)
    setFeedExhausted(false)
    setDeck(shuffleItems(skippedPool))
    showToast(t("rewindOn"))
  }, [loading, busy, feedExhausted, deck.length, skippedPool, showToast, t])

  const visibleStack = useMemo(() => deck.slice(0, STACK_VISIBLE), [deck])

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
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.listingId, qty: 1 }),
      })
      if (res.status === 401) {
        addGuestCartItem({
          productId: item.listingId,
          qty: 1,
          title: item.title,
          price: item.priceCents / 100,
          imageUrl: item.mediaUrl,
        })
      }
      console.log("[buyer-swipe-commerce]", { listingId: item.listingId, result: "cart" })
      showToast(t("cartAdded"))
    },
    [showToast, t]
  )

  const saveDrop = useCallback(
    async (item: PulseFeedItem) => {
      if (!item.productId) return
      const res = await fetch("/api/wishlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.productId }),
      })
      if (res.status === 401) {
        router.push(
          `/signup/customer?callbackUrl=${encodeURIComponent(
            discoverSwipeHref({ category: categoryId, subcategory: subcategoryId })
          )}`
        )
        return
      }
      if (res.ok) {
        console.log("[buyer-swipe-commerce]", { productId: item.productId, result: "save-drop" })
        showToast(t("saveDrop"))
      }
    },
    [categoryId, subcategoryId, router, showToast, t]
  )

  const buyNow = useCallback(
    async (item: PulseFeedItem) => {
      if (!item.listingId) return
      const { fastCheckoutNeedsLogin, fastCheckoutRedirected, startFastCheckout } =
        await import("@/lib/fast-checkout-client")
      const result = await startFastCheckout(
        {
          productId: item.listingId,
          qty: 1,
          successPath: "/discover?success=true",
          cancelPath: discoverSwipeHref({ category: categoryId, subcategory: subcategoryId }),
        },
        { loginCallbackUrl: discoverSwipeHref({ category: categoryId, subcategory: subcategoryId }) }
      )
      if (fastCheckoutRedirected(result)) return
      if (fastCheckoutNeedsLogin(result)) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(
            discoverSwipeHref({ category: categoryId, subcategory: subcategoryId })
          )}`
        )
      }
    },
    [categoryId, subcategoryId, router]
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
        showToast(e instanceof Error ? e.message : "Erreur")
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

  return (
    <div
      data-testid="affisell-pulse"
      className={cn(affisellBrand.epoxyPage, "fixed inset-0 z-[140] flex flex-col")}
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

      <header className="relative z-40 shrink-0 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className={cn(affisellBrand.epoxyPanel, "mx-auto flex max-w-[420px] items-center justify-between gap-2 px-3 py-2")}>
          <Link
            href={exitHref}
            className={cn(affisellBrand.epoxyChip, "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white/90")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            {tPulse("exit")}
          </Link>
          <div className="flex flex-col items-center">
            <span className={affisellBrand.brandWordmark}>{tPulse("brand")}</span>
            <span className="mt-1 flex items-center gap-1.5">
              <span className={cn(affisellBrand.epoxyChip, "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-100")}>
                {tPulse("beta")}
              </span>
              {replayMode ? (
                <span className={cn(affisellBrand.epoxyChip, "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-100")}>
                  {t("rewindBadge")}
                </span>
              ) : null}
            </span>
            {categoryLabel ? (
              <p className="mt-0.5 max-w-[12rem] truncate text-[10px] text-zinc-400">{categoryLabel}</p>
            ) : null}
          </div>
          <span className={cn(affisellBrand.epoxyChip, "tabular-nums rounded-full px-2 py-1 text-xs text-white/80")}>
            {deck.length > 0 ? deck.length : "—"}
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[380px] flex-1 px-3 pb-2">
        <div className="relative mx-auto h-[min(62dvh,560px)] w-full">
          <AnimatePresence mode="popLayout">
            {visibleStack.length === 0 && loading ? (
              <motion.div
                key="loading"
                className="flex h-full items-center justify-center"
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
        </div>

        <p className="mt-3 text-center text-[11px] text-zinc-400">{t("hint")}</p>
      </div>

      <footer className={cn(affisellBrand.epoxyPanel, "relative z-40 mx-3 mb-3 shrink-0 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]")}>
        <div className="mx-auto grid max-w-[380px] grid-cols-5 gap-2">
          <button
            type="button"
            disabled={busy || deck.length === 0}
            onClick={() => requestSwipe("left")}
            className={affisellBrand.epoxyActionBtn}
            aria-label={t("skip")}
          >
            <ChevronLeft className="size-5" />
            {t("skipShort")}
          </button>
          <button
            type="button"
            disabled={busy || deck.length === 0}
            onClick={() => requestSwipe("up")}
            className={affisellBrand.epoxyActionCart}
            aria-label={t("cart")}
          >
            <ShoppingBag className="size-5" />
            {t("cartShort")}
          </button>
          <button
            type="button"
            disabled={skippedPool.length === 0 || busy}
            onClick={handleUndo}
            className={affisellBrand.epoxyActionBtn}
            aria-label={t("undo")}
          >
            <RotateCcw className="size-5" />
            Undo
          </button>
          <button
            type="button"
            disabled={busy || deck.length === 0}
            onClick={() => requestSwipe("right")}
            className={affisellBrand.epoxyActionBuy}
            aria-label={t("buy")}
          >
            <Zap className="size-5" />
            {t("buyShort")}
          </button>
          <button
            type="button"
            disabled={busy || deck.length === 0}
            onClick={() => requestSwipe("down")}
            className={affisellBrand.epoxyActionDrop}
            aria-label={t("saveDrop")}
          >
            <Bookmark className="size-5" />
            Drop
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-[380px] justify-center gap-2">
          <Link
            href={discoverSwipeHref({ category: categoryId, subcategory: subcategoryId, layout: "scroll" })}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-zinc-400 hover:text-white")}
          >
            <Layers className="mr-1 size-3.5" />
            {t("scrollMode")}
          </Link>
        </div>
      </footer>

      <AnimatePresence>
        {toast ? (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              affisellBrand.epoxyToast,
              "fixed bottom-36 left-1/2 z-50 max-w-[90vw] -translate-x-1/2"
            )}
            role="status"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
