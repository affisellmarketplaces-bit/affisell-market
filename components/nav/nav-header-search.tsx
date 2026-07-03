"use client"

import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, Sparkles, Store, TrendingUp } from "lucide-react"
import { useTranslations } from "next-intl"
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react"
import { useDebouncedCallback } from "use-debounce"

import { FastLink } from "@/components/navigation/fast-link"
import { AFFILIATE_CATALOG_PATH, shopListingPath } from "@/lib/affiliate-routes"
import { navigateBuyerHomeCatalog } from "@/lib/marketplace-catalog-nav.client"
import {
  PUBLIC_NAV_SEARCH_QUICK_LINKS,
  type PublicNavSearchContext,
} from "@/lib/public-nav-search-context"
import { cn } from "@/lib/utils"

type ProductHit = {
  id: string
  name: string
  image: string | null
  price: number
  storeSlug: string | null
}

type Props = {
  id: string
  placeholder?: string
  /** Where unscoped search submits. */
  searchTarget?: "marketplace" | "shops" | "catalog"
  /** Buyer header — context chip + focus suggestions. */
  enableSuggestions?: boolean
  searchContext?: PublicNavSearchContext | null
}

const CONTEXT_LABEL_KEYS: Record<PublicNavSearchContext, string> = {
  home: "contextHome",
  marketplace: "contextMarketplace",
  creatorStores: "contextCreatorStores",
}

export function NavHeaderSearch({
  id,
  placeholder,
  searchTarget = "marketplace",
  enableSuggestions = false,
  searchContext = null,
}: Props) {
  const tNav = useTranslations("nav")
  const tPublic = useTranslations("PublicNav")
  const listboxId = useId()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rootRef = useRef<HTMLDivElement>(null)

  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<ProductHit[]>([])
  const [loading, setLoading] = useState(false)

  const resolvedPlaceholder =
    placeholder ?? (searchTarget === "catalog" ? tNav("searchCatalog") : tNav("searchProducts"))

  const defaultQ =
    searchTarget === "marketplace" && pathname === "/"
      ? (searchParams.get("q") ?? "")
      : searchTarget === "catalog" &&
          (pathname === AFFILIATE_CATALOG_PATH || pathname.startsWith(`${AFFILIATE_CATALOG_PATH}/`))
        ? (searchParams.get("q") ?? "")
        : ""

  useEffect(() => {
    if (enableSuggestions) {
      setQ(defaultQ)
    }
  }, [defaultQ, enableSuggestions])

  const fetchProducts = useDebouncedCallback(async (needle: string) => {
    if (!enableSuggestions) return
    setLoading(true)
    try {
      const url =
        needle.length >= 2
          ? `/api/marketplace/products?q=${encodeURIComponent(needle)}`
          : "/api/marketplace/products?lite=1"
      const res = await fetch(url)
      const data = (await res.json()) as { products?: ProductHit[] }
      setProducts((data.products ?? []).slice(0, 6))
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, 260)

  useEffect(() => {
    if (!open || !enableSuggestions) return
    void fetchProducts(q.trim())
  }, [open, q, enableSuggestions, fetchProducts])

  useEffect(() => {
    if (!enableSuggestions) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [enableSuggestions])

  const submitQuery = useCallback(
    (raw: string) => {
      const trimmed = raw.trim()
      if (searchTarget === "shops") {
        router.push(trimmed ? `/shops?q=${encodeURIComponent(trimmed)}` : "/shops")
        return
      }
      if (searchTarget === "catalog") {
        const params =
          pathname === AFFILIATE_CATALOG_PATH || pathname.startsWith(`${AFFILIATE_CATALOG_PATH}/`)
            ? new URLSearchParams(searchParams.toString())
            : new URLSearchParams()
        if (trimmed) params.set("q", trimmed)
        else params.delete("q")
        const qs = params.toString()
        router.push(qs ? `${AFFILIATE_CATALOG_PATH}?${qs}` : AFFILIATE_CATALOG_PATH)
        return
      }
      const params =
        pathname === "/" ? new URLSearchParams(searchParams.toString()) : new URLSearchParams()
      if (trimmed) params.set("q", trimmed)
      else params.delete("q")
      navigateBuyerHomeCatalog(router, params)
    },
    [pathname, router, searchParams, searchTarget]
  )

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (enableSuggestions) {
      submitQuery(q)
      setOpen(false)
      return
    }
    const fd = new FormData(ev.currentTarget)
    submitQuery(String(fd.get("q") ?? ""))
  }

  const runProduct = useCallback(
    (product: ProductHit) => {
      setOpen(false)
      setQ(product.name)
      if (product.storeSlug) {
        router.push(shopListingPath(product.storeSlug, product.id))
        return
      }
      submitQuery(product.name)
    },
    [router, submitQuery]
  )

  const contextLabel =
    enableSuggestions && searchContext ? tPublic(CONTEXT_LABEL_KEYS[searchContext]) : null
  const showPanel = enableSuggestions && open

  if (!enableSuggestions) {
    return (
      <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={onSubmit} role="search">
        <div className="relative flex min-w-0 flex-1 items-center">
          <label htmlFor={id} className="sr-only">
            {tNav("searchAria")}
          </label>
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" aria-hidden />
          <input
            id={id}
            name="q"
            type="search"
            enterKeyHint="search"
            defaultValue={defaultQ}
            key={defaultQ}
            placeholder={resolvedPlaceholder}
            autoComplete="off"
            className="h-10 w-full min-w-0 rounded-full border-0 bg-transparent py-2 pl-9 pr-2 text-zinc-900 shadow-none outline-none placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-100"
          />
        </div>
      </form>
    )
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={onSubmit} role="search">
        <div className="relative flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <label htmlFor={id} className="sr-only">
            {tNav("searchAria")}
          </label>
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" aria-hidden />
          {contextLabel ? (
            <span className="pointer-events-none absolute left-9 hidden max-w-[5.5rem] truncate rounded-full bg-violet-100/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 sm:inline dark:bg-violet-950/70 dark:text-violet-200">
              {contextLabel}
            </span>
          ) : null}
          <input
            id={id}
            name="q"
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={resolvedPlaceholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={showPanel ? listboxId : undefined}
            className={cn(
              "h-10 w-full min-w-0 rounded-full border-0 bg-transparent py-2 pr-2 text-zinc-900 shadow-none outline-none placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-100",
              contextLabel ? "pl-[7.25rem] sm:pl-[8.5rem]" : "pl-9"
            )}
          />
        </div>
      </form>

      {showPanel ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[300] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/98 shadow-xl shadow-violet-500/10 backdrop-blur-md dark:border-zinc-700/90 dark:bg-zinc-950/98"
        >
          <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {q.trim().length >= 2 ? tPublic("searchProductsTitle") : tPublic("searchQuickTitle")}
            </p>
            {q.trim().length < 2 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PUBLIC_NAV_SEARCH_QUICK_LINKS.map((link) => (
                  <FastLink
                    key={link.id}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 rounded-full border border-violet-200/80 bg-violet-50/90 px-2.5 py-1 text-xs font-semibold text-violet-900 transition hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-100"
                  >
                    {link.id === "discover" ? (
                      <Sparkles className="size-3" aria-hidden />
                    ) : link.id === "shops" ? (
                      <Store className="size-3" aria-hidden />
                    ) : (
                      <TrendingUp className="size-3" aria-hidden />
                    )}
                    {tPublic(link.labelKey)}
                  </FastLink>
                ))}
              </div>
            ) : null}
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-2 text-xs text-zinc-500">{tPublic("searchLoading")}</li>
            ) : products.length === 0 ? (
              <li className="px-3 py-2 text-xs text-zinc-500">{tPublic("searchNoResults")}</li>
            ) : (
              products.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => runProduct(product)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-violet-50/80 dark:hover:bg-violet-950/35"
                  >
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {product.name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {product.price.toFixed(2)} €
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
