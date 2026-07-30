"use client"

import { useCallback, useEffect, useId, useRef, useState, type TouchEvent } from "react"
import { Clock, Search, Sparkles, Store, Swords, TrendingUp, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useDebouncedCallback } from "use-debounce"

import { FastLink } from "@/components/navigation/fast-link"
import { MOBILE_SEARCH_OPEN_EVENT } from "@/lib/buyer-hub-events"
import { shopListingPath } from "@/lib/affiliate-routes"
import { navigateBuyerHomeCatalog } from "@/lib/marketplace-catalog-nav.client"
import { buyerHaptic } from "@/lib/buyer-haptics"
import { PUBLIC_NAV_SEARCH_QUICK_LINKS } from "@/lib/public-nav-search-context"
import { cn } from "@/lib/utils"

const HISTORY_KEY = "affisell_mobile_search_history_v1"
const MAX_HISTORY = 8

type ProductHit = {
  id: string
  name: string
  image: string | null
  price: number
  storeSlug: string | null
}

function readHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_HISTORY)
  } catch {
    return []
  }
}

function writeHistory(items: string[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)))
  } catch {
    /* ignore */
  }
}

/** Full-screen mobile search — autofocus, history, product hits, swipe-down dismiss. */
export function MobileSearchOverlay() {
  const t = useTranslations("PublicNav")
  const tHub = useTranslations("marketplace.mobileHub")
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const touchStartY = useRef<number | null>(null)

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [products, setProducts] = useState<ProductHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onOpen = () => {
      buyerHaptic("tap")
      setHistory(readHistory())
      setOpen(true)
    }
    window.addEventListener(MOBILE_SEARCH_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(MOBILE_SEARCH_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const tmr = window.setTimeout(() => inputRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(tmr)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const fetchProducts = useDebouncedCallback(async (needle: string) => {
    if (!open) return
    setLoading(true)
    try {
      const url =
        needle.length >= 2
          ? `/api/marketplace/products?q=${encodeURIComponent(needle)}`
          : "/api/marketplace/products?lite=1"
      const res = await fetch(url)
      const data = (await res.json()) as { products?: ProductHit[] }
      setProducts((data.products ?? []).slice(0, 8))
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, 260)

  useEffect(() => {
    if (!open) return
    void fetchProducts(q.trim())
  }, [open, q, fetchProducts])

  const close = useCallback(() => {
    setOpen(false)
    setQ("")
  }, [])

  const commitSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim()
      if (!trimmed) return
      const next = [trimmed, ...readHistory().filter((h) => h.toLowerCase() !== trimmed.toLowerCase())]
      writeHistory(next)
      setHistory(next)
      close()
      navigateBuyerHomeCatalog(router, { q: trimmed })
    },
    [close, router]
  )

  const onTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null
  }

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStartY.current
    touchStartY.current = null
    if (start == null) return
    const end = e.changedTouches[0]?.clientY ?? start
    if (end - start > 90 && (sheetRef.current?.scrollTop ?? 0) <= 0) {
      close()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[320] flex flex-col bg-zinc-950/95 backdrop-blur-xl lg:hidden"
      role="dialog"
      aria-modal
      aria-label={t("searchLabel")}
    >
      <div
        className="mx-auto mt-[max(0.5rem,env(safe-area-inset-top))] h-1 w-10 shrink-0 rounded-full bg-white/25"
        aria-hidden
      />
      <div
        ref={sheetRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            commitSearch(q)
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 shadow-lg shadow-violet-500/10 ring-1 ring-violet-400/10">
            <Search className="size-4 shrink-0 text-violet-300" aria-hidden />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-500"
              autoComplete="off"
              enterKeyHint="search"
              aria-controls={listboxId}
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
                aria-label={tHub("close")}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-zinc-200 hover:bg-white/10 hover:text-white"
          >
            {tHub("close")}
          </button>
        </form>

        <p className="mt-2 px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          {tHub("searchSwipeHint")}
        </p>

        {!q.trim() ? (
          <div className="mt-3 flex flex-wrap gap-1.5 px-0.5">
            {PUBLIC_NAV_SEARCH_QUICK_LINKS.map((link) => (
              <FastLink
                key={link.id}
                href={link.href}
                onClick={close}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-violet-400/35 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 transition active:scale-[0.98] hover:bg-violet-500/25"
              >
                {link.id === "discover" ? (
                  <Sparkles className="size-3.5" aria-hidden />
                ) : link.id === "shops" ? (
                  <Store className="size-3.5" aria-hidden />
                ) : link.id === "battles" ? (
                  <Swords className="size-3.5" aria-hidden />
                ) : (
                  <TrendingUp className="size-3.5" aria-hidden />
                )}
                {t(link.labelKey)}
              </FastLink>
            ))}
          </div>
        ) : null}

        {history.length > 0 && !q.trim() ? (
          <div className="mt-4">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {tHub("searchHistory")}
            </p>
            <ul className="space-y-1">
              {history.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => commitSearch(item)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                  >
                    <Clock className="size-3.5 shrink-0 text-zinc-500" aria-hidden />
                    <span className="truncate">{item}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4" id={listboxId} role="listbox">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {loading ? tHub("loading") : tHub("searchSuggestions")}
          </p>
          <ul className="space-y-1">
            {products.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    close()
                    if (p.storeSlug) {
                      router.push(shopListingPath(p.storeSlug, p.id))
                      return
                    }
                    commitSearch(p.name)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2 text-left transition hover:bg-white/[0.07]"
                >
                  <span
                    className={cn(
                      "size-11 shrink-0 overflow-hidden rounded-lg bg-zinc-800",
                      !p.image && "flex items-center justify-center text-[10px] text-zinc-500"
                    )}
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="size-full object-cover" />
                    ) : (
                      "?"
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-100">{p.name}</span>
                    <span className="text-[11px] text-zinc-500">
                      {(p.price / 100).toLocaleString(undefined, {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
