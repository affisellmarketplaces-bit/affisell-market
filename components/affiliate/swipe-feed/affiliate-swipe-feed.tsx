"use client"

import Link from "next/link"
import {
  ArrowLeft,
  Filter,
  Heart,
  Layers,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { SwipeCard, type SwipeCardHandle } from "@/components/affiliate/swipe-feed/swipe-card"
import {
  SwipeFiltersSheet,
  swipeFiltersActiveCount,
} from "@/components/affiliate/swipe-feed/swipe-filters-sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import type {
  SwipeFeedFilters,
  SwipeFeedProduct,
  SwipeHistoryEntry,
} from "@/lib/affiliate-swipe-feed-types"
import { cn } from "@/lib/utils"

const DEFAULT_MARKUP = 0.3
const STACK_VISIBLE = 3
const PREFETCH_WHEN_LEFT = 3

function buildFeedQuery(filters: SwipeFeedFilters, take: number): string {
  const params = new URLSearchParams()
  params.set("take", String(take))
  if (filters.categoryId) params.set("categoryId", filters.categoryId)
  if (filters.niche) params.set("niche", filters.niche)
  if (filters.minCommission) params.set("minCommission", String(filters.minCommission))
  if (filters.q) params.set("q", filters.q)
  return params.toString()
}

type Props = {
  initialMode?: "hub" | "swipe"
}

export function AffiliateSwipeFeed({ initialMode = "hub" }: Props) {
  const [mode, setMode] = useState<"hub" | "swipe">(initialMode)
  const [deck, setDeck] = useState<SwipeFeedProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [feedExhausted, setFeedExhausted] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [filters, setFilters] = useState<SwipeFeedFilters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [history, setHistory] = useState<SwipeHistoryEntry[]>([])
  const [sessionStats, setSessionStats] = useState({ listed: 0, skipped: 0 })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dragProgress, setDragProgress] = useState(0)
  const fetchingRef = useRef(false)
  const deckRef = useRef(deck)
  const topCardRef = useRef<SwipeCardHandle>(null)
  deckRef.current = deck

  const filterCount = swipeFiltersActiveCount(filters)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2400)
  }, [])

  const fetchMore = useCallback(
    async (replace = false) => {
      if (fetchingRef.current) return
      fetchingRef.current = true
      setLoading(true)
      setFetchError(null)
      try {
        const qs = buildFeedQuery(filters, 12)
        const res = await fetch(`/api/affiliate/swipe-feed?${qs}`, { cache: "no-store" })
        const data = (await res.json().catch(() => ({}))) as {
          products?: SwipeFeedProduct[]
          error?: string
          dbUnavailable?: boolean
        }

        if (!res.ok) {
          const msg =
            data.dbUnavailable
              ? "Service temporairement indisponible — réessayez dans un instant."
              : data.error ?? "Impossible de charger le feed"
          setFetchError(msg)
          setFeedExhausted(true)
          showToast(msg)
          return
        }

        const incoming = data.products ?? []
        if (incoming.length === 0) {
          setFeedExhausted(true)
        } else if (replace) {
          setFeedExhausted(false)
        }

        setDeck((prev) => {
          if (replace) return incoming
          if (incoming.length === 0) return prev
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
        showToast("Impossible de charger le feed")
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    },
    [filters, showToast]
  )

  useEffect(() => {
    if (mode !== "swipe") return
    setFeedExhausted(false)
    void fetchMore(true)
  }, [mode, filters, fetchMore])

  useEffect(() => {
    if (mode !== "swipe") return
    if (feedExhausted || loading || deck.length === 0) return
    if (deck.length <= PREFETCH_WHEN_LEFT) {
      void fetchMore(false)
    }
  }, [deck.length, mode, loading, feedExhausted, fetchMore])

  const visibleStack = useMemo(() => deck.slice(0, STACK_VISIBLE), [deck])

  const requestSwipe = useCallback(
    (direction: "left" | "right") => {
      if (busy || deckRef.current.length === 0) return
      topCardRef.current?.swipe(direction)
    },
    [busy]
  )

  const commitSwipe = useCallback(
    async (direction: "left" | "right") => {
      const product = deckRef.current[0]
      if (!product || busy) return

      setBusy(true)
      setDragProgress(0)

      try {
        if (direction === "right") {
          const res = await fetch("/api/affiliate/listings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: product.id, markupRate: DEFAULT_MARKUP }),
          })
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string }
            throw new Error(err.error ?? "Listing failed")
          }
          const listing = (await res.json()) as { id?: string }
          setHistory((h) => [
            { product, action: "like", listingId: listing.id },
            ...h.slice(0, 19),
          ])
          setSessionStats((s) => ({ ...s, listed: s.listed + 1 }))
          showToast(`✓ ${product.name.slice(0, 40)} listé à +30%`)
        } else {
          const res = await fetch("/api/affiliate/swipes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: product.id, action: "skip" }),
          })
          if (!res.ok) throw new Error("Skip failed")
          setHistory((h) => [{ product, action: "skip" }, ...h.slice(0, 19)])
          setSessionStats((s) => ({ ...s, skipped: s.skipped + 1 }))
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Erreur réseau")
        topCardRef.current?.reset()
        setBusy(false)
        return
      }

      setDeck((d) => d.slice(1))
      setBusy(false)
    },
    [busy, showToast]
  )

  const handleUndo = useCallback(async () => {
    const last = history[0]
    if (!last || busy) return

    setBusy(true)
    try {
      if (last.action === "skip") {
        await fetch(`/api/affiliate/swipes?productId=${encodeURIComponent(last.product.id)}`, {
          method: "DELETE",
        })
        setSessionStats((s) => ({ ...s, skipped: Math.max(0, s.skipped - 1) }))
      } else if (last.listingId) {
        await fetch(`/api/affiliate/products/${encodeURIComponent(last.listingId)}`, {
          method: "DELETE",
        }).catch(() => null)
        await fetch(`/api/affiliate/swipes?productId=${encodeURIComponent(last.product.id)}`, {
          method: "DELETE",
        })
        setSessionStats((s) => ({ ...s, listed: Math.max(0, s.listed - 1) }))
      }

      setDeck((d) => [last.product, ...d.filter((p) => p.id !== last.product.id)])
      setHistory((h) => h.slice(1))
      showToast("Action annulée")
    } catch {
      showToast("Impossible d'annuler")
    } finally {
      setBusy(false)
    }
  }, [history, busy, showToast])

  useEffect(() => {
    if (mode !== "swipe") return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowRight") requestSwipe("right")
      if (e.key === "ArrowLeft") requestSwipe("left")
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) void handleUndo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mode, requestSwipe, handleUndo])

  if (mode === "hub") {
    return (
      <div className="relative min-h-[calc(100dvh-3.75rem)] overflow-hidden bg-zinc-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-violet-600/30 blur-[100px]" />
          <div className="absolute -right-20 bottom-32 h-80 w-80 rounded-full bg-fuchsia-600/25 blur-[100px]" />
          <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[90px]" />
        </div>

        <div className="relative mx-auto max-w-2xl px-4 py-10 md:px-8 md:py-16">
          <Link
            href={AFFILIATE_CATALOG_PATH}
            className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Catalogue classique
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-300 ring-1 ring-violet-400/30">
              <Zap className="size-3.5" aria-hidden />
              Nouveau — Hub affilié
            </p>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Swipe Feed
            </h1>
            <p className="mt-4 max-w-lg text-lg text-zinc-400">
              Découvrez des produits en un geste. Swipez à droite pour lister à +30% markup,
              à gauche pour masquer définitivement.
            </p>
          </motion.div>

          <motion.button
            type="button"
            onClick={() => setMode("swipe")}
            className="group relative mt-10 w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/40 via-fuchsia-600/30 to-indigo-700/40 p-8 text-left shadow-2xl shadow-violet-950/50 transition-transform hover:scale-[1.02] active:scale-[0.99]"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-violet-200/90">Mode immersif</p>
                <p className="mt-1 text-2xl font-bold">Lancer le Swipe Feed</p>
                <p className="mt-2 text-sm text-zinc-300/80">
                  Stack de 3 cartes · Undo · Filtres commission
                </p>
              </div>
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm transition-transform group-hover:rotate-6">
                <Layers className="size-8 text-white" aria-hidden />
              </div>
            </div>
          </motion.button>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Heart, label: "Swipe →", desc: "Liste à +30%" },
              { icon: X, label: "Swipe ←", desc: "Masque le SKU" },
              { icon: RotateCcw, label: "Undo", desc: "Annule le dernier" },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm"
              >
                <Icon className="mb-2 size-5 text-violet-400" aria-hidden />
                <p className="font-semibold">{label}</p>
                <p className="text-sm text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-3.75rem)] flex-col overflow-hidden bg-gradient-to-b from-zinc-50 via-violet-50/40 to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:via-violet-950/30 dark:to-zinc-950 dark:text-zinc-50">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-violet-400/20 blur-[100px] dark:bg-violet-600/25"
          animate={{ x: [0, 30, 0], opacity: [0.4, 0.65, 0.4] }}
          style={{ scale: 1 + Math.max(0, dragProgress) * 0.08 }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-16 bottom-20 h-80 w-80 rounded-full bg-teal-400/15 blur-[90px] dark:bg-fuchsia-600/20"
          animate={{ x: [0, -20, 0], opacity: [0.35, 0.55, 0.35] }}
          style={{ scale: 1 + Math.max(0, -dragProgress) * 0.08 }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <div
          className="absolute inset-0 bg-emerald-400/8 transition-opacity duration-75 dark:bg-emerald-500/10"
          style={{ opacity: Math.max(0, dragProgress) * 0.5 }}
        />
        <div
          className="absolute inset-0 bg-rose-400/8 transition-opacity duration-75 dark:bg-rose-500/10"
          style={{ opacity: Math.max(0, -dragProgress) * 0.5 }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={() => setMode("hub")}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Hub
        </button>

        <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-xs shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/70">
          <Sparkles className="size-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
          <span className="font-medium text-emerald-700 dark:text-emerald-400">{sessionStats.listed} listés</span>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <span className="text-zinc-500 dark:text-zinc-400">{sessionStats.skipped} passés</span>
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={cn(
            "relative inline-flex size-9 items-center justify-center rounded-full border border-zinc-200/80 bg-white/80 shadow-sm backdrop-blur-md transition-colors hover:bg-white dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800",
            filterCount > 0 && "border-violet-400 text-violet-700 dark:border-violet-500/50 dark:text-violet-300"
          )}
          aria-label="Filtres"
        >
          <Filter className="size-4" />
          {filterCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold">
              {filterCount}
            </span>
          )}
        </button>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-sm flex-1 px-4 pb-4">
        <div className="relative mx-auto h-[min(68dvh,580px)] w-full max-w-[340px]">
          <AnimatePresence mode="popLayout">
            {visibleStack.length === 0 && !loading ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center"
              >
                <Layers className="mb-4 size-12 text-zinc-600" aria-hidden />
                <p className="text-lg font-semibold">
                  {fetchError ? "Feed indisponible" : "Plus de cartes"}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {fetchError ??
                    "Tous les produits disponibles sont listés ou passés. Essayez le catalogue ou réinitialisez les filtres."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button
                    type="button"
                    className="bg-violet-600 hover:bg-violet-500"
                    onClick={() => {
                      setFeedExhausted(false)
                      setFetchError(null)
                      void fetchMore(true)
                    }}
                  >
                    Recharger
                  </Button>
                  <Link
                    href={AFFILIATE_CATALOG_PATH}
                    className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "border-zinc-700")}
                  >
                    Catalogue
                  </Link>
                </div>
              </motion.div>
            ) : (
              visibleStack.map((product, i) => (
                <SwipeCard
                  key={product.id}
                  ref={i === 0 ? topCardRef : undefined}
                  product={product}
                  stackIndex={i}
                  isTop={i === 0 && !busy}
                  markupRate={DEFAULT_MARKUP}
                  onSwipeComplete={commitSwipe}
                  onDragProgress={i === 0 ? setDragProgress : undefined}
                />
              ))
            )}
          </AnimatePresence>

          {loading && deck.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="size-10 rounded-full border-2 border-violet-500/30 border-t-violet-400"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-zinc-500 dark:text-zinc-500">
          ← Passer · → Lister (+30%) · ⌘Z Annuler
        </p>
      </div>

      <footer className="relative z-10 border-t border-zinc-200/80 bg-white/85 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-white/5 dark:bg-zinc-950/90 md:px-6">
        <div className="mx-auto flex max-w-[340px] items-center justify-center gap-4">
          <button
            type="button"
            disabled={busy || deck.length === 0}
            onClick={() => requestSwipe("left")}
            className="group flex size-14 items-center justify-center rounded-full border-2 border-rose-300 bg-white text-rose-600 shadow-md transition-all hover:scale-110 hover:border-rose-400 hover:shadow-rose-200/80 active:scale-95 disabled:opacity-40 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/25"
            aria-label="Passer"
          >
            <X className="size-7 transition-transform group-active:-translate-x-0.5" />
          </button>

          <button
            type="button"
            disabled={history.length === 0 || busy}
            onClick={() => void handleUndo()}
            className="flex size-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-all hover:border-zinc-300 disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            aria-label="Annuler"
          >
            <RotateCcw className="size-5" />
          </button>

          <button
            type="button"
            disabled={busy || deck.length === 0}
            onClick={() => requestSwipe("right")}
            className="group flex size-14 items-center justify-center rounded-full border-2 border-emerald-300 bg-white text-emerald-600 shadow-md transition-all hover:scale-110 hover:border-emerald-400 hover:shadow-emerald-200/80 active:scale-95 disabled:opacity-40 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/25"
            aria-label="Lister"
          >
            <Heart className="size-7 transition-transform group-active:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-all hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
              filterCount > 0 && "border-violet-400 text-violet-700 dark:border-violet-500/50 dark:text-violet-300"
            )}
            aria-label="Filtres"
          >
            <Filter className="size-5" />
          </button>
        </div>
      </footer>

      <SwipeFiltersSheet
        open={filtersOpen}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next)
          setDeck([])
          setHistory([])
          setFeedExhausted(false)
          setFetchError(null)
        }}
      />

      <AnimatePresence>
        {toast && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-800/95 px-4 py-2 text-sm text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md"
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
