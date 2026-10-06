"use client"

import { Loader2, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { normalizeSearchText, SEARCH_MIN_CHARS } from "@/lib/storefront/storefront-search"
import { cn } from "@/lib/utils"

type Result = { listingId: string; name: string; priceCents: number; imageUrl: string | null }

type Props = {
  slug: string
  accent?: string
  onClose: () => void
}

const DEBOUNCE_MS = 160

/**
 * Instant search inside the store — a keyboard-first palette (combobox + listbox pattern): type, ↑ ↓ to move, Enter to open,
 * Esc to close. Results come from `/api/shops/{slug}/search` (the store's own cached catalog, filtered in memory).
 */
export function StorefrontSearchPalette({ slug, accent = "#7c3aed", onClose }: Props) {
  const t = useTranslations("storefront.search")
  const router = useRouter()
  const listId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocusTo = useRef<Element | null>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  const searchable = normalizeSearchText(query).length >= SEARCH_MIN_CHARS
  const hrefFor = useCallback(
    (r: Result) => `/shops/${encodeURIComponent(slug)}/product/${encodeURIComponent(r.listingId)}`,
    [slug]
  )

  // Focus the field on open and keep the page behind from scrolling. The opener is remembered ONCE (an effect that re-runs must
  // not take the field itself for the opener) and gets focus back only on an explicit close — never from a cleanup, which
  // would fight the focus we just set when React re-runs the effect.
  useEffect(() => {
    if (!returnFocusTo.current) returnFocusTo.current = document.activeElement
    inputRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const close = useCallback(() => {
    onClose()
    const opener = returnFocusTo.current as HTMLElement | null
    window.setTimeout(() => opener?.focus?.(), 0)
  }, [onClose])

  useEffect(() => {
    if (!searchable) {
      setResults([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/shops/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        })
        const json = (await res.json()) as { results?: Result[] }
        setResults(res.ok && Array.isArray(json.results) ? json.results : [])
        setActive(0)
      } catch {
        /* aborted by a newer keystroke, or offline: keep what is shown */
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, searchable, slug])

  const open = useCallback(
    (r: Result) => {
      onClose()
      router.push(hrefFor(r))
    },
    [hrefFor, onClose, router]
  )

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault()
      close()
    } else if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault()
      open(results[active])
    } else if (e.key === "Tab") {
      // Keep keyboard focus inside the dialog.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("input, button, a[href]")
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const optionId = (i: number) => `${listId}-opt-${i}`

  return (
    <div className="fixed inset-0 z-[150]" onKeyDown={onKeyDown}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("close")}
        className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm"
        onClick={close}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="absolute left-1/2 top-[5vh] w-[min(94vw,38rem)] -translate-x-1/2 overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-2xl shadow-black/30 sm:top-[10vh] dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-3 border-b border-zinc-200/80 px-4 dark:border-zinc-800">
          {loading ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-zinc-400" aria-hidden />
          ) : (
            <Search className="size-5 shrink-0 text-zinc-400" aria-hidden />
          )}
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          />
          <button
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="max-h-[min(60dvh,26rem)] overflow-y-auto overscroll-contain">
          {results.length > 0 ? (
            <>
              <p className="sr-only" role="status">
                {t("resultsCount", { count: results.length })}
              </p>
              <ul id={listId} role="listbox" aria-label={t("title")} className="p-2">
                {results.map((r, i) => (
                  <li key={r.listingId} role="presentation">
                    <a
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      href={hrefFor(r)}
                      onClick={(e) => {
                        e.preventDefault()
                        open(r)
                      }}
                      onMouseMove={() => setActive(i)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl p-2 outline-none transition",
                        i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""
                      )}
                      style={i === active ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
                    >
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-xl bg-zinc-100 object-cover" />
                      ) : (
                        <span aria-hidden className="size-12 shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{r.name}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                        {formatStoreCurrencyFromCents(r.priceCents)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400" role="status">
              {!searchable ? t("hint") : loading ? t("loading") : t("empty", { query: query.trim() })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
