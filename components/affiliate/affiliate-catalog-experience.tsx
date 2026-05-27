"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowDownWideNarrow,
  Check,
  Compass,
  ExternalLink,
  Filter,
  Search,
  Sparkles,
  Store,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { AffiliateCatalogHighlights } from "@/components/affiliate/affiliate-catalog-highlights"
import { DiscoverListingActions } from "@/components/affiliate/discover-listing-actions"
import {
  ListingBuilderModal,
  type SerializedListing,
} from "@/components/affiliate/listing-builder-modal"
import { AffiliateHero } from "@/components/marketplace/AffiliateHero"
import { MarketplaceDepartmentRail } from "@/components/marketplace/MarketplaceDepartmentRail"
import { Sidebar } from "@/components/marketplace/Sidebar"
import { Button } from "@/components/ui/button"
import { AFFILIATE_AGENT_PATH, AFFILIATE_CATALOG_PATH, AFFILIATE_HUB_PATH } from "@/lib/affiliate-routes"
import { resolveCatalogListingState } from "@/lib/affiliate-catalog-listing-state"
import {
  AFFILIATE_CATALOG_NICHES,
  type AffiliateCatalogHighlights as HighlightsData,
  type AffiliateCatalogProduct,
} from "@/lib/affiliate-catalog-types"
import type { HomeMarketplaceStats } from "@/lib/home-marketplace-cards"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { primaryProductImage } from "@/lib/product-images"
import { cn } from "@/lib/utils"

type CatalogProduct = {
  id: string
  name: string
  description?: string
  images: string[]
  categories?: string[]
  colors?: string[]
  tags?: string[]
  variants?: unknown
  basePriceCents: number
  commissionRate: number
  deliveryMax?: number | null
  createdAt?: string | null
  hasVariants?: boolean
  productVariants?: Array<{ color: string | null; size: string | null; stock: number }>
  affiliateProducts?: { id: string; isListed: boolean }[]
  supplier: { email: string; store?: { name: string; slug: string } | null }
}

type DiscoverSortKey = "new" | "commission-desc" | "price-asc" | "price-desc" | "name"

const NICHE_PILLS = [
  { id: "fitness", label: "Fitness" },
  { id: "tech", label: "Tech" },
  { id: "maison", label: "Maison" },
] as const

const PULSE_LINKS = [
  {
    href: AFFILIATE_HUB_PATH,
    label: "Swipe Feed",
    hint: "Lister en 1 geste",
    className: "from-violet-600 to-fuchsia-600",
  },
  {
    href: AFFILIATE_AGENT_PATH,
    label: "Agent sourcing",
    hint: "Analyser & choisir vos SKU",
    className: "from-violet-600 to-indigo-600",
  },
  { href: "/discover", label: "Discover", hint: "Signaux marché", className: "from-fuchsia-600 to-pink-600" },
  {
    href: `${AFFILIATE_CATALOG_PATH}?highlight=margin`,
    label: "High margin",
    hint: "Marges partenaires",
    className: "from-emerald-600 to-teal-600",
  },
  {
    href: "/dashboard/affiliate",
    label: "Ma vitrine",
    hint: "Gérer les fiches live",
    className: "from-amber-600 to-orange-600",
  },
] as const

type Props = {
  stats: HomeMarketplaceStats
  initialHighlights: HighlightsData
}

function supplierLabel(p: AffiliateCatalogProduct) {
  const brand = p.supplier.store?.name?.trim()
  if (brand) return brand
  return p.supplier.email
}

export function AffiliateCatalogExperience({ stats, initialHighlights }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryId = searchParams.get("category")
  const subcategoryId = searchParams.get("subcategory")
  const searchQuery = searchParams.get("q") ?? ""
  const activeNiche = searchParams.get("niche")?.trim().toLowerCase() ?? ""

  const [products, setProducts] = useState<AffiliateCatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<DiscoverSortKey>("new")
  const [storeSlug, setStoreSlug] = useState<string | null>(null)

  const [modalProduct, setModalProduct] = useState<CatalogProduct | null>(null)
  const [modalListing, setModalListing] = useState<SerializedListing | null>(null)
  const [releasingListingId, setReleasingListingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const productDeepLinkConsumed = useRef(false)

  const filterKey = searchParams.toString()

  const hasFilters = Boolean(
    categoryId || subcategoryId || searchQuery.trim() || activeNiche || searchParams.get("highlight")
  )

  useEffect(() => {
    const highlight = searchParams.get("highlight")
    if (highlight && ["bestsellers", "new", "margin"].includes(highlight)) {
      requestAnimationFrame(() => {
        document.getElementById("catalog-highlights")?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }, [searchParams])

  useEffect(() => {
    void fetch("/api/affiliate/bootstrap", { credentials: "include" })
      .then(async (r) => {
        const data = (await r.json()) as { storeSlug?: string | null }
        if (r.ok) setStoreSlug(data.storeSlug ?? null)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams(searchParams.toString())
    if (sort !== "new") params.set("sort", sort)
    const qs = params.toString()
    void fetch(`/api/affiliate/discover-catalog${qs ? `?${qs}` : ""}`, { credentials: "include" })
      .then(async (r) => {
        const data = (await r.json()) as { products?: AffiliateCatalogProduct[]; error?: string }
        if (!r.ok) throw new Error(data.error ?? "Impossible de charger le catalogue")
        setProducts(Array.isArray(data.products) ? data.products : [])
      })
      .catch((e: unknown) => {
        setProducts([])
        setError(e instanceof Error ? e.message : "Impossible de charger le catalogue")
      })
      .finally(() => setLoading(false))
  }, [filterKey, sort, searchParams])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }

  async function refreshCatalogProducts() {
    const params = new URLSearchParams(searchParams.toString())
    if (sort !== "new") params.set("sort", sort)
    const qs = params.toString()
    try {
      const r = await fetch(`/api/affiliate/discover-catalog${qs ? `?${qs}` : ""}`, { credentials: "include" })
      const data = (await r.json()) as { products?: AffiliateCatalogProduct[] }
      if (r.ok && Array.isArray(data.products)) setProducts(data.products)
    } catch {
      // catalog refresh is best-effort after release
    }
  }

  async function releaseFromStorefront(listingId: string) {
    setReleasingListingId(listingId)
    try {
      const res = await fetch("/api/affiliate/products/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: [listingId] }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        deletedIds?: string[]
        hiddenIds?: string[]
        error?: string
      }
      if (!res.ok) {
        showToast(data.error ?? "Impossible de libérer la fiche")
        return
      }
      const hidden = data.hiddenIds?.length ?? 0
      const deleted = data.deletedIds?.length ?? 0
      if (hidden > 0) showToast("Retiré de la vitrine — prêt à réimporter")
      else if (deleted > 0) showToast("Produit libéré — de nouveau dans Discover")
      else showToast("Fiche retirée de la vitrine")
      await refreshCatalogProducts()
    } finally {
      setReleasingListingId(null)
    }
  }

  async function loadProductForModal(productId: string): Promise<CatalogProduct | null> {
    const cached = products.find((x) => x.id === productId)
    try {
      const r = await fetch(`/api/affiliate/catalog-product/${encodeURIComponent(productId)}`, {
        credentials: "include",
      })
      const data = (await r.json()) as { product?: CatalogProduct; error?: string }
      if (!r.ok || !data.product) {
        showToast(data.error ?? "Détails produit indisponibles")
        return cached ? (cached as CatalogProduct) : null
      }
      return data.product
    } catch {
      showToast("Détails produit indisponibles")
      return cached ? (cached as CatalogProduct) : null
    }
  }

  async function openCreate(productId: string) {
    const full = await loadProductForModal(productId)
    if (!full) return
    setModalProduct(full)
    setModalListing(null)
  }

  async function openEdit(productId: string, listingId: string) {
    const full = await loadProductForModal(productId)
    if (!full) return
    try {
      const r = await fetch("/api/affiliate/bootstrap", { credentials: "include" })
      const data = (await r.json()) as { listings?: SerializedListing[] }
      const row = data.listings?.find((l) => l.id === listingId && l.productId === productId)
      setModalProduct(full)
      setModalListing(
        row ?? {
          id: listingId,
          productId,
          sellingPriceCents: full.basePriceCents,
          customImages: [],
          collections: [],
          isListed: true,
          promotedVariantKeys: [],
        }
      )
    } catch {
      setModalProduct(full)
      setModalListing({
        id: listingId,
        productId,
        sellingPriceCents: full.basePriceCents,
        customImages: [],
        collections: [],
        isListed: true,
        promotedVariantKeys: [],
      })
    }
  }

  const onPickProduct = useCallback(
    (productId: string, listingId: string | null) => {
      if (listingId) void openEdit(productId, listingId)
      else void openCreate(productId)
    },
    [openCreate, openEdit]
  )

  useEffect(() => {
    if (productDeepLinkConsumed.current || loading) return
    const pid = searchParams.get("productId")?.trim()
    if (!pid) return
    const row = products.find((p) => p.id === pid)
    if (!row) return
    productDeepLinkConsumed.current = true
    const listingState = resolveCatalogListingState(row.affiliateProducts)
    const listingId = listingState.kind !== "none" ? listingState.listingId : null
    void (listingId ? openEdit(pid, listingId) : openCreate(pid))
    const params = new URLSearchParams(searchParams.toString())
    params.delete("productId")
    const s = params.toString()
    router.replace(`${AFFILIATE_CATALOG_PATH}${s ? `?${s}` : ""}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link from agent cards
  }, [loading, products, searchParams, openCreate, openEdit, router])

  const handleCategoryClick = (catId: string, subId?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("category")
    params.delete("subcategory")
    if (subId) params.set("subcategory", subId)
    else params.set("category", catId)
    const s = params.toString()
    router.push(`${AFFILIATE_CATALOG_PATH}${s ? `?${s}` : ""}`)
  }

  const setNiche = (niche: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (activeNiche === niche) params.delete("niche")
    else params.set("niche", niche)
    const s = params.toString()
    router.push(`${AFFILIATE_CATALOG_PATH}${s ? `?${s}` : ""}`)
  }

  function clearFilters() {
    router.push(AFFILIATE_CATALOG_PATH)
  }

  const filteredCount = products.length

  const activeCategoryLabel = useMemo(() => {
    if (subcategoryId) return "Sous-catégorie active"
    if (categoryId) return "Rayon actif"
    if (activeNiche && activeNiche in AFFILIATE_CATALOG_NICHES) {
      return NICHE_PILLS.find((n) => n.id === activeNiche)?.label ?? activeNiche
    }
    return null
  }, [categoryId, subcategoryId, activeNiche])

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 md:px-8">
        <AffiliateHero stats={stats} />

        <AffiliateCatalogHighlights initial={initialHighlights} onPickProduct={onPickProduct} />

        <section aria-label="Catalogue fournisseur" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                Catalogue · Vitrine
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                Parcourir &amp; importer
              </h2>
              {activeCategoryLabel ? (
                <p className="mt-1 text-sm text-zinc-500">
                  Filtre : <span className="font-semibold text-violet-700 dark:text-violet-300">{activeCategoryLabel}</span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="gap-1.5">
                  <X className="h-4 w-4" aria-hidden />
                  Réinitialiser
                </Button>
              ) : null}
              <div className="relative">
                <ArrowDownWideNarrow
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as DiscoverSortKey)}
                  className="appearance-none rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-8 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-950"
                  aria-label="Trier le catalogue"
                >
                  <option value="new">Nouveautés</option>
                  <option value="commission-desc">Commission ↓</option>
                  <option value="price-asc">Prix fournisseur ↑</option>
                  <option value="price-desc">Prix fournisseur ↓</option>
                  <option value="name">Titre A–Z</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Filter className="h-3.5 w-3.5" aria-hidden />
              Domaines
            </span>
            {NICHE_PILLS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNiche(n.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  activeNiche === n.id
                    ? "border-violet-500 bg-violet-600 text-white shadow-md"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                )}
              >
                {n.label}
              </button>
            ))}
          </div>

          <section
            className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
            aria-label="Raccourcis affilié"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Couche Affisell</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {PULSE_LINKS.map(({ href, label, hint, className }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex min-h-[4rem] flex-col justify-center gap-0.5 rounded-xl bg-gradient-to-br px-3 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95",
                      className
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="size-4 shrink-0 opacity-90" aria-hidden />
                      {label}
                    </span>
                    <span className="text-[11px] font-normal opacity-90">{hint}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <MarketplaceDepartmentRail
            activeCategoryId={categoryId}
            activeSubcategoryId={subcategoryId}
            catalogBasePath={AFFILIATE_CATALOG_PATH}
          />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-[5.25rem] lg:w-[min(19rem,100%)] lg:max-w-[19rem] lg:self-start">
              <Sidebar
                onCategoryClick={handleCategoryClick}
                activeCategoryId={categoryId}
                activeSubcategoryId={subcategoryId}
              />
            </aside>

            <div className="min-w-0 flex-1">
              <form
                className="mb-6 max-w-xl"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const next = new URLSearchParams(searchParams.toString())
                  const localQ = String(fd.get("localQ") ?? "").trim()
                  if (localQ) next.set("q", localQ)
                  else next.delete("q")
                  const s = next.toString()
                  router.push(`${AFFILIATE_CATALOG_PATH}${s ? `?${s}` : ""}`)
                }}
              >
                <label htmlFor="affiliate-catalog-search" className="sr-only">
                  Rechercher dans le catalogue
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                    aria-hidden
                  />
                  <input
                    id="affiliate-catalog-search"
                    name="localQ"
                    type="search"
                    defaultValue={searchQuery}
                    placeholder="Nom produit, marque, niche…"
                    className="h-11 w-full rounded-xl border border-zinc-200/90 bg-white/95 py-2 pl-10 pr-3 text-sm shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900/80"
                  />
                </div>
              </form>

              {error ? (
                <div
                  role="alert"
                  className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                >
                  {error}
                </div>
              ) : null}

              {!loading ? (
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{filteredCount}</strong> SKU
                  {searchQuery.trim() ? (
                    <>
                      {" "}
                      pour « {searchQuery.trim()} »
                    </>
                  ) : null}
                </p>
              ) : null}

              {loading ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-violet-200/70 bg-white/80 px-6 py-16 text-center dark:border-violet-900/40 dark:bg-zinc-950/50">
                  <Compass className="mx-auto h-10 w-10 text-violet-500" aria-hidden />
                  <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Aucun SKU pour ces filtres</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                    Changez de rayon, de domaine ou réinitialisez pour voir tout le catalogue partenaire.
                  </p>
                  {hasFilters ? (
                    <Button type="button" className="mt-6" onClick={clearFilters}>
                      Tout afficher
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((p) => {
                    const listingState = resolveCatalogListingState(p.affiliateProducts)
                    const isLive = listingState.kind === "live"
                    const isHidden = listingState.kind === "hidden"
                    const listingId = listingState.kind !== "none" ? listingState.listingId : undefined
                    const thumb = primaryProductImage(p.images) || "/placeholder-product.jpg"
                    const margin = Math.round((p.basePriceCents * (Number(p.commissionRate) || 0)) / 100)
                    const supplierHref = p.supplier.store?.slug
                      ? `/store/supplier/${encodeURIComponent(p.supplier.store.slug)}`
                      : null
                    return (
                      <article
                        key={p.id}
                        className={cn(
                          "relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition hover:shadow-lg dark:bg-zinc-950 dark:ring-zinc-800",
                          isLive && "border-emerald-200/80 ring-emerald-200/60",
                          isHidden && "border-amber-200/80 ring-amber-200/60",
                          !isLive && !isHidden && "border-zinc-100 ring-zinc-100 hover:border-violet-200"
                        )}
                      >
                        {isLive ? (
                          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-xs text-white shadow">
                            <Check className="h-3 w-3" aria-hidden />
                            En vitrine
                          </div>
                        ) : null}
                        {isHidden ? (
                          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-white shadow">
                            Hors vitrine
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="relative aspect-square w-full bg-gradient-to-b from-zinc-50 to-white p-4 text-left dark:from-zinc-900 dark:to-zinc-950"
                          onClick={() => onPickProduct(p.id, listingId ?? null)}
                        >
                          <Image
                            src={thumb}
                            alt=""
                            fill
                            className="object-contain p-2"
                            sizes="320px"
                            unoptimized={thumb.startsWith("http")}
                          />
                        </button>
                        <div className="flex flex-1 flex-col gap-2 p-4">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50"
                              onClick={() => onPickProduct(p.id, listingId ?? null)}
                            >
                              {p.name}
                            </button>
                            {supplierHref ? (
                              <Link
                                href={`/store/supplier/${encodeURIComponent(p.supplier.store!.slug)}/product/${encodeURIComponent(p.id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-teal-700 hover:bg-teal-50 dark:border-zinc-700 dark:text-teal-400"
                                aria-label="Fiche fournisseur"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden />
                              </Link>
                            ) : null}
                          </div>
                          {(p.categories?.length ?? 0) > 0 ? (
                            <p className="line-clamp-1 text-xs text-zinc-500">
                              {p.categories.slice(0, 2).join(" · ")}
                            </p>
                          ) : null}
                          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                            <div>
                              <p className="text-[10px] font-medium uppercase text-zinc-500">Prix fournisseur</p>
                              <p className="text-base font-bold tabular-nums">
                                {formatStoreCurrencyFromCents(p.basePriceCents)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-medium uppercase text-violet-600">Commission</p>
                              <p className="text-base font-bold tabular-nums text-violet-700 dark:text-violet-300">
                                {p.commissionRate}%
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            Marge estimée {formatStoreCurrencyFromCents(margin)}
                          </p>
                          {supplierHref ? (
                            <Link href={supplierHref} className="flex items-center gap-1 truncate text-xs text-violet-700">
                              <Store className="h-3.5 w-3.5" aria-hidden />
                              {supplierLabel(p)}
                            </Link>
                          ) : (
                            <p className="truncate text-xs text-zinc-400">{supplierLabel(p)}</p>
                          )}
                          <DiscoverListingActions
                            state={listingState}
                            locale="fr"
                            releasing={
                              listingState.kind !== "none" && releasingListingId === listingState.listingId
                            }
                            onAdd={() => void openCreate(p.id)}
                            onEdit={(id) => void openEdit(p.id, id)}
                            onRelease={releaseFromStorefront}
                          />
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <ListingBuilderModal
        open={modalProduct != null}
        product={modalProduct}
        listing={modalListing}
        storeSlug={storeSlug}
        onClose={() => {
          setModalProduct(null)
          setModalListing(null)
        }}
        onSaved={() => {
          setModalProduct(null)
          setModalListing(null)
          showToast("Fiche enregistrée sur votre vitrine")
          void refreshCatalogProducts()
        }}
      />

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg md:bottom-8"
        >
          {toast}
        </div>
      ) : null}
    </>
  )
}
