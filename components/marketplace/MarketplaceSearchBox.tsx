"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"
import { cn } from "@/lib/utils"

type SuggestionProduct = {
  listingId: string
  title: string
  image: string | null
  price: number
}

type SuggestionCategory = {
  id: string
  breadcrumb: string
}

type Props = {
  basePath?: string
  className?: string
}

export function MarketplaceSearchBox({ basePath = "/shops/browse", className }: Props) {
  const t = useTranslations("marketplace.search")
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get("q") ?? ""
  const [q, setQ] = useState(initialQ)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<SuggestionProduct[]>([])
  const [categories, setCategories] = useState<SuggestionCategory[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQ(initialQ)
  }, [initialQ])

  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setProducts([])
      setCategories([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(() => {
      fetch(`/api/marketplace/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data: { products?: SuggestionProduct[]; categories?: SuggestionCategory[] }) => {
          setProducts(data.products ?? [])
          setCategories(data.categories ?? [])
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setProducts([])
            setCategories([])
          }
        })
        .finally(() => setLoading(false))
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [q])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  function submitSearch(term: string) {
    const trimmed = term.trim()
    const params = new URLSearchParams(searchParams.toString())
    if (trimmed) params.set("q", trimmed)
    else params.delete("q")
    setOpen(false)
    router.push(marketplaceCatalogHref(basePath, params))
  }

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitSearch(q)
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          aria-expanded={open}
          aria-controls="marketplace-search-suggestions"
          className="h-12 w-full rounded-2xl border border-zinc-200/90 bg-white pl-12 pr-24 text-base shadow-sm outline-none ring-violet-500/30 focus:border-violet-300 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 h-9 -translate-y-1/2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {t("submit")}
        </button>
      </form>

      {open && q.trim().length >= 2 ? (
        <div
          id="marketplace-search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(24rem,70vh)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loading")}
            </div>
          ) : null}

          {!loading && products.length === 0 && categories.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-500">{t("noResults")}</p>
          ) : null}

          {categories.length > 0 ? (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                {t("categories")}
              </p>
              <ul>
                {categories.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-violet-50 dark:text-zinc-200 dark:hover:bg-violet-950/40"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete("subcategory")
                        params.delete("subcategoryId")
                        params.set("category", c.id)
                        params.delete("q")
                        setOpen(false)
                        router.push(marketplaceCatalogHref(basePath, params))
                      }}
                    >
                      <span className="line-clamp-2 text-xs leading-snug">{c.breadcrumb}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {products.length > 0 ? (
            <div>
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                {t("products")}
              </p>
              <ul>
                {products.map((p) => (
                  <li key={p.listingId}>
                    <Link
                      href={`/marketplace/${p.listingId}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                      onClick={() => setOpen(false)}
                    >
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {p.title}
                        </span>
                        <span className="text-xs text-violet-700 dark:text-violet-300">
                          {t("priceFrom", { price: p.price.toFixed(2) })}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-1 w-full rounded-lg py-2 text-center text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300"
                onClick={() => submitSearch(q)}
              >
                {t("seeAllResults")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
