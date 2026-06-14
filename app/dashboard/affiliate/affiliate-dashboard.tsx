"use client"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowDownWideNarrow,
  BadgePercent,
  Check,
  ChevronRight,
  Compass,
  ExternalLink,
  Eye,
  Filter,
  GripVertical,
  Handshake,
  LayoutGrid,
  Palette,
  Pencil,
  Search,
  Sparkles,
  Store,
  TrendingUp,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import AffiliateLiveStore from "@/components/affiliate/affiliate-live-store"
import { DiscoverListingActions } from "@/components/affiliate/discover-listing-actions"
import { BentoStat } from "@/components/affisell/bento-ui"
import { MerchantMyCatalogCue } from "@/components/dashboard/merchant-my-catalog-cue"
import {
  ListingBuilderModal,
  type SerializedListing,
} from "@/components/affiliate/listing-builder-modal"
import { resolveCatalogListingState } from "@/lib/affiliate-catalog-listing-state"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import { COLORS, isMulticolorSwatch } from "@/lib/product-catalog-constants"
import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { affisellBrand } from "@/lib/affisell-brand"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"
import { primaryProductImage } from "@/lib/product-images"

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
  /** Present on Supplier Catalog query; may be absent on nested `listing.product`. */
  affiliateProducts?: { id: string; isListed: boolean }[]
  supplier: { email: string; store?: { name: string; slug: string } | null }
}

type DiscoverSortKey = "new" | "commission-desc" | "price-asc" | "price-desc" | "name"

function supplierDisplayLabel(p: CatalogProduct) {
  const brand = p.supplier.store?.name?.trim()
  if (brand) return brand
  return p.supplier.email
}

function isSkuFresh(iso: string | null | undefined, days = 14) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t < days * 86_400_000
}

type Listing = SerializedListing & {
  position: number
  product: CatalogProduct | null
}

function sortAffiliateListingByPosition(a: Listing, b: Listing) {
  if (a.position !== b.position) return a.position - b.position
  return a.id.localeCompare(b.id)
}

function SortableStoreCard(props: {
  listing: Listing
  selected: boolean
  onSelect: () => void
  onToggleList: () => void
}) {
  const { listing, selected, onSelect, onToggleList } = props
  const p = listing.product

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listing.id,
  })

  if (!p) return null

  const shopperReward = buyerRewardBadgeText(
    normalizeBuyerRewardKind(listing.buyerRewardKind),
    listing.buyerRewardPercent ?? 0
  )

  const title = listingDisplayTitle(listing.customTitle ?? null, p.name)
  const img =
    listingPrimaryImageUrl(listing.customImages ?? [], p.images ?? []) ||
    primaryProductImage(p.images) ||
    ""

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.9 : undefined,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white/90 shadow-sm backdrop-blur-sm transition dark:border-zinc-800 dark:bg-zinc-950/80 ${
        selected ? "ring-2 ring-[#10B981]" : "hover:shadow-md"
      }`}
    >
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
        {(listing.product?.deliveryMax ?? 99) <= 3 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
            Fast Shipping
          </span>
        ) : null}
        {listing.isFeatured ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
            Featured
          </span>
        ) : null}
      </div>
      <label className="absolute left-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/90 shadow ring-1 ring-gray-100 dark:bg-zinc-800/95 dark:ring-zinc-600">
        <input type="checkbox" checked={selected} onChange={() => onSelect()} className="h-4 w-4 accent-emerald-600 dark:accent-emerald-400" />
      </label>
      <button
        type="button"
        className="absolute left-14 top-3 z-10 flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-lg bg-white/90 text-gray-500 shadow ring-1 ring-gray-100 active:cursor-grabbing dark:bg-zinc-800/95 dark:text-zinc-300 dark:ring-zinc-600"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="relative aspect-square bg-gray-50 p-4 dark:bg-zinc-900/80">
        <Image
          src={img || "/placeholder.png"}
          alt=""
          fill
          className="object-contain p-3"
          sizes="260px"
          unoptimized={img.startsWith("http")}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
          <p className="line-clamp-2 flex-1 text-sm font-semibold leading-snug text-gray-900 dark:text-zinc-50">{title}</p>
        </div>
        <p className="text-lg font-semibold text-[#10B981] dark:text-emerald-400">
          {formatStoreCurrencyFromCents(listing.sellingPriceCents)}
        </p>
        {shopperReward ? (
          <p className="text-xs font-medium text-teal-800 dark:text-teal-200">
            Shoppers:{" "}
            <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] text-teal-900 dark:bg-teal-950/60 dark:text-teal-100">
              {shopperReward}
            </span>
          </p>
        ) : null}
        <p className="text-xs text-gray-500 dark:text-zinc-300">
          {listing.clicks ?? 0} clicks · {listing.conversions ?? 0} sales
        </p>
        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-300">
          <input type="checkbox" checked={listing.isListed} onChange={() => void onToggleList()} className="accent-emerald-600 dark:accent-emerald-400" />
          Listed
        </label>
        <div className="mt-3 flex flex-col gap-2">
          <Link
            href={`/dashboard/affiliate/products/${listing.id}/edit`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <Pencil className="h-4 w-4" aria-hidden /> Edit
          </Link>
        </div>
      </div>
    </article>
  )
}

type Props = {
  storeId: string
}

export function AffiliateDashboard({ storeId }: Props) {
  const tHub = useTranslations("affiliate.hub")
  const tAffiliate = useTranslations("affiliate")
  const router = useRouter()
  const searchParams = useSearchParams()
  const productDeepLinkConsumed = useRef(false)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string | null>(null)
  const [bootstrapLoading, setBootstrapLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [tab, setTab] = useState<"catalog" | "store">("catalog")
  const [listings, setListings] = useState<Listing[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [modalProduct, setModalProduct] = useState<CatalogProduct | null>(null)
  const [modalListing, setModalListing] = useState<SerializedListing | null>(null)
  const [releasingListingId, setReleasingListingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setBootstrapLoading(true)
    setBootstrapError(null)
    void fetch("/api/affiliate/bootstrap", { credentials: "include" })
      .then(async (r) => {
        const data = (await r.json()) as {
          listings?: Listing[]
          storeSlug?: string | null
          storeName?: string | null
          error?: string
        }
        if (!cancelled) {
          if (Array.isArray(data.listings)) {
            setListings([...data.listings].sort(sortAffiliateListingByPosition))
          }
          setStoreSlug(data.storeSlug ?? null)
          setStoreName(data.storeName?.trim() || null)
          if (!r.ok) setBootstrapError(data.error ?? "Could not load your storefront data")
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setBootstrapError(e instanceof Error ? e.message : "Could not load your storefront data")
        }
      })
      .finally(() => {
        if (!cancelled) setBootstrapLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setCatalogLoading(true)
    setCatalogError(null)
    void fetch("/api/affiliate/discover-catalog", { credentials: "include" })
      .then(async (r) => {
        const data = (await r.json()) as { products?: CatalogProduct[]; error?: string }
        if (!r.ok) throw new Error(data.error ?? "Could not load catalog")
        if (!cancelled) setCatalog(Array.isArray(data.products) ? data.products : [])
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setCatalog([])
          setCatalogError(e instanceof Error ? e.message : "Could not load catalog")
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshDashboardData = useCallback(async () => {
    try {
      const [bootRes, catRes] = await Promise.all([
        fetch("/api/affiliate/bootstrap", { credentials: "include" }),
        fetch("/api/affiliate/discover-catalog", { credentials: "include" }),
      ])
      const boot = (await bootRes.json()) as {
        listings?: Listing[]
        storeSlug?: string | null
        storeName?: string | null
        error?: string
      }
      const cat = (await catRes.json()) as { products?: CatalogProduct[]; error?: string }
      if (Array.isArray(boot.listings)) {
        setListings([...boot.listings].sort(sortAffiliateListingByPosition))
      }
      setStoreSlug(boot.storeSlug ?? null)
      setStoreName(boot.storeName?.trim() || null)
      setBootstrapError(bootRes.ok ? null : (boot.error ?? "Could not load your storefront data"))
      if (catRes.ok && Array.isArray(cat.products)) {
        setCatalog(cat.products)
        setCatalogError(null)
      } else if (!catRes.ok) {
        setCatalogError(cat.error ?? "Could not load catalog")
      }
    } catch {
      setBootstrapError("Could not refresh dashboard data")
    }
  }, [])

  const reorderPersist = useCallback(
    async (next: Listing[]) => {
      await fetch("/api/affiliate/products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderedIds: next.map((l) => l.id) }),
      }).catch(() => null)
    },
    []
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {})
  )

  const onDragEnd = useCallback(
    (evt: DragEndEvent) => {
      const { active, over } = evt
      if (!over || active.id === over.id) return
      setListings((prev) => {
        const ids = prev.map((l) => l.id)
        const oi = ids.indexOf(active.id as string)
        const ni = ids.indexOf(over.id as string)
        if (oi < 0 || ni < 0) return prev
        const next = arrayMove(prev, oi, ni).map((l, idx) => ({ ...l, position: idx }))
        void reorderPersist(next)
        return next
      })
    },
    [reorderPersist]
  )

  async function toggleList(listingId: string, cur: boolean) {
    await fetch(`/api/affiliate/listings/${listingId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isListed: !cur }),
    })
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, isListed: !cur } : l)).sort(sortAffiliateListingByPosition)
    )
  }

  async function bulkPatch(opts: { isFeatured?: boolean; isListed?: boolean }) {
    const idsSel = [...selected]
    if (!idsSel.length) return
    const body: Record<string, unknown> = { ids: idsSel, ...opts }
    await fetch("/api/affiliate/products/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })
    setSelected(new Set())
    if (opts.isListed === false) setToast("Hidden from storefront (still in your account)")
    else if (opts.isFeatured === true) setToast("Featured selections")
    else setToast("Updated selections")
    void refreshDashboardData()
  }

  async function removeListingsFromStorefront(listingIds: string[]) {
    if (!listingIds.length) return
    const res = await fetch("/api/affiliate/products/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids: listingIds }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      deletedIds?: string[]
      hiddenIds?: string[]
      error?: string
    }
    if (!res.ok) {
      setToast(data.error ?? "Could not remove listings")
      return
    }
    const deleted = data.deletedIds?.length ?? 0
    const hidden = data.hiddenIds?.length ?? 0
    if (deleted > 0 && hidden > 0) {
      setToast(
        `${deleted} removed from storefront · ${hidden} hidden (past sales — re-add from Discover)`
      )
    } else if (hidden > 0) {
      setToast(`${hidden} hidden from storefront (order history kept)`)
    } else {
      setToast(deleted === 1 ? "Removed from storefront" : `${deleted} removed from storefront`)
    }
    setSelected(new Set())
    void refreshDashboardData()
  }

  async function loadProductForModal(productId: string): Promise<CatalogProduct | null> {
    const cached = catalog.find((x) => x.id === productId)
    if (cached?.description != null && cached.variants !== undefined) return cached

    try {
      const r = await fetch(`/api/affiliate/catalog-product/${encodeURIComponent(productId)}`, {
        credentials: "include",
      })
      const data = (await r.json()) as { product?: CatalogProduct; error?: string }
      if (!r.ok || !data.product) {
        setToast(data.error ?? "Could not load product details")
        return cached ?? null
      }
      return data.product
    } catch {
      setToast("Could not load product details")
      return cached ?? null
    }
  }

  async function openCreate(p: CatalogProduct) {
    const full = await loadProductForModal(p.id)
    if (!full) return
    setModalProduct(full)
    setModalListing(null)
  }

  function openEditModal(productId: string) {
    const listingRow = listings.find((l) => l.productId === productId)
    const p =
      catalog.find((x) => x.id === productId) ??
      (listingRow?.product && listingRow.product.id === productId ? listingRow.product : null)
    if (listingRow && p) void openEdit(listingRow, p)
  }

  function openEditByListingId(productId: string, listingId: string) {
    const listingRow = listings.find((l) => l.id === listingId)
    const p =
      catalog.find((x) => x.id === productId) ??
      (listingRow?.product && listingRow.product.id === productId ? listingRow.product : null)
    if (listingRow && p) void openEdit(listingRow, p)
    else openEditModal(productId)
  }

  async function releaseDiscoverListing(listingId: string) {
    setReleasingListingId(listingId)
    try {
      await removeListingsFromStorefront([listingId])
    } finally {
      setReleasingListingId(null)
    }
  }

  async function openEdit(listing: Listing, p: CatalogProduct) {
    const full = (await loadProductForModal(p.id)) ?? p
    setModalProduct(full)
    setModalListing({
      id: listing.id,
      productId: listing.productId,
      sellingPriceCents: listing.sellingPriceCents,
      customTitle: listing.customTitle,
      customDescription: listing.customDescription,
      customImages: listing.customImages ?? [],
      customSlug: listing.customSlug,
      seoTitle: listing.seoTitle,
      seoDescription: listing.seoDescription,
      collections: listing.collections ?? [],
      luxuryTier: listing.luxuryTier ?? "NONE",
      luxuryCollectionId: listing.luxuryCollectionId ?? null,
      isListed: listing.isListed,
      isFeatured: listing.isFeatured,
      promotedColor: listing.promotedColor ?? null,
      promotedSize: listing.promotedSize ?? null,
      promotedVariantKeys: listing.promotedVariantKeys ?? [],
      showWarranty: listing.showWarranty ?? false,
    })
  }

  function viewStore() {
    if (!storeSlug) {
      router.push("/dashboard/affiliate/settings/store")
      return
    }
    window.open(`/shops/${encodeURIComponent(storeSlug)}`, "_blank", "noopener,noreferrer")
  }

  useEffect(() => {
    if (productDeepLinkConsumed.current || catalogLoading) return
    const pid = searchParams.get("productId")?.trim()
    if (!pid) return
    productDeepLinkConsumed.current = true

    const p = catalog.find((x) => x.id === pid)
    if (!p) {
      setToast("That product isn’t in this Discover batch. Browse the marketplace to find more SKUs.")
      router.replace("/dashboard/affiliate", { scroll: false })
      return
    }

    setTab("catalog")
    requestAnimationFrame(() => {
      document.getElementById(`catalog-product-${pid}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    })

  const listingState = resolveCatalogListingState(p.affiliateProducts)
  void (listingState.kind === "none" ? openCreate(p) : openEditModal(pid))

    router.replace("/dashboard/affiliate", { scroll: false })
    // One-shot deep link — handlers intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume `productId` once on landing
  }, [catalog, catalogLoading, router, searchParams])

  const listingsWithProduct = listings.filter((l): l is Listing & { product: CatalogProduct } =>
    Boolean(l.product)
  )
  const storefrontListings = listingsWithProduct.filter((l) => l.isListed)
  const listedLiveCount = storefrontListings.length
  const ids = storefrontListings.map((l) => l.id)
  const discoverSkuCount = catalog.length
  const addableSkuCount = catalog.filter((p) => !(p.affiliateProducts?.length ?? 0)).length

  const [discoverQ, setDiscoverQ] = useState("")
  const [discoverSort, setDiscoverSort] = useState<DiscoverSortKey>("new")
  const [discoverUnlistedOnly, setDiscoverUnlistedOnly] = useState(false)

  const insightClicks = useMemo(
    () => listingsWithProduct.reduce((s, l) => s + (l.clicks ?? 0), 0),
    [listingsWithProduct]
  )
  const insightSales = useMemo(
    () => listingsWithProduct.reduce((s, l) => s + (l.conversions ?? 0), 0),
    [listingsWithProduct]
  )

  const showWelcome = searchParams.get("welcome") === "1"

  const filteredDiscover = useMemo(() => {
    let rows = [...catalog]
    if (discoverUnlistedOnly) {
      rows = rows.filter((p) => resolveCatalogListingState(p.affiliateProducts).kind !== "live")
    }
    const q = discoverQ.trim().toLowerCase()
    if (q) {
      rows = rows.filter((p) => {
        if (p.name.toLowerCase().includes(q)) return true
        if (p.tags?.some((t) => t.toLowerCase().includes(q))) return true
        if (p.categories?.some((c) => c.toLowerCase().includes(q))) return true
        if (supplierDisplayLabel(p).toLowerCase().includes(q)) return true
        return false
      })
    }
    rows.sort((a, b) => {
      switch (discoverSort) {
        case "commission-desc":
          return b.commissionRate - a.commissionRate
        case "price-asc":
          return a.basePriceCents - b.basePriceCents
        case "price-desc":
          return b.basePriceCents - a.basePriceCents
        case "name":
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        case "new":
        default: {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return tb - ta
        }
      }
    })
    return rows
  }, [catalog, discoverQ, discoverSort, discoverUnlistedOnly])

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] text-zinc-900 dark:text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        {showWelcome ? (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-950 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-100"
          >
            <p className="font-semibold">Bienvenue dans votre espace créateur</p>
            <p className="mt-1 text-violet-900/90 dark:text-violet-200/90">
              Configurez votre boutique ci-dessous, puis explorez le{" "}
              <Link href={AFFILIATE_CATALOG_PATH} className="font-medium underline underline-offset-2">
                catalogue ambassadeur
              </Link>{" "}
              pour ajouter vos premiers produits.
            </p>
          </div>
        ) : null}
        {bootstrapError ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p className="font-semibold">{tHub("storefrontUnavailable")}</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">{bootstrapError}</p>
          </div>
        ) : null}
        <header className={affisellBrand.headerShell}>
          <div className={affisellBrand.headerMesh} aria-hidden />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className={affisellBrand.badgeAffiliate}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {tAffiliate("dashboardTagline")}
                </div>
                <div>
                  <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                    {storeName ? tHub("greeting", { storeName }) : tHub("storefrontTitle")}
                  </h1>
                  <MerchantMyCatalogCue
                    href={AFFILIATE_CATALOG_PATH}
                    label={tHub("myCatalog")}
                    variant="affiliate"
                  />
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-[15px]">
                    {tHub("storefrontSubtitle")}
                  </p>
                </div>
                <nav className="flex flex-wrap gap-2 sm:gap-2.5" aria-label="Quick links">
                  {(
                    [
                      {
                        label: tHub("inviteSupplier"),
                        href: "/dashboard/affiliate/invite-supplier",
                        Icon: Handshake,
                      },
                      {
                        label: tHub("browseMarketplace"),
                        href: AFFILIATE_CATALOG_PATH,
                        Icon: Compass,
                      },
                      {
                        label: tHub("earningsCockpit"),
                        href: "/dashboard/affiliate/earnings",
                        Icon: Wallet,
                      },
                      {
                        label: tHub("brandStudio"),
                        href: "/dashboard/affiliate/brand-studio",
                        Icon: Palette,
                      },
                      {
                        label: tHub("storeProfile"),
                        href: "/dashboard/affiliate/settings/store",
                        Icon: Store,
                      },
                      {
                        label: tHub("communitySocial"),
                        href: "/dashboard/settings/social",
                        Icon: UsersRound,
                      },
                      {
                        label: tHub("accountSecurity"),
                        href: "/dashboard/settings/account",
                        Icon: UserRound,
                      },
                    ] as const
                  ).map(({ label, href, Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => router.push(href)}
                      className={cn(affisellBrand.quickLink, "affisell-quick-link--affiliate")}
                    >
                      <span className={affisellBrand.quickLinkIconAffiliate}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-affiliate"
                        aria-hidden
                      />
                    </button>
                  ))}
                </nav>
              </div>
              <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col xl:max-w-[280px]">
                <div className="flex flex-wrap gap-2 sm:justify-end lg:justify-start">
                  <AffiliateLiveStore storeId={storeId} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    type="button"
                    onClick={() => viewStore()}
                    className={cn("inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold", affisellBrand.ctaBrand)}
                  >
                    <Eye className="h-4 w-4 shrink-0" aria-hidden /> {tHub("openPublicStore")}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 border-t border-gray-100/90 pt-8 dark:border-zinc-800 sm:grid-cols-3">
              <BentoStat
                className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                label={tHub("discoverFeed")}
                value={
                  <>
                    {discoverSkuCount}
                    <span className="ml-1 text-base font-medium text-gray-500 dark:text-zinc-300">{tHub("skus")}</span>
                  </>
                }
                hint={
                  addableSkuCount > 0 ? (
                    <>
                      <span className="font-semibold text-[#10B981] dark:text-emerald-400">{addableSkuCount}</span> ready
                      to list
                    </>
                  ) : (
                    <>You’ve picked up the surfaced batch—refresh often for more.</>
                  )
                }
              />
              <BentoStat
                className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                label={tHub("yourListings")}
                value={listingsWithProduct.length}
                hint="Curated resale rows in builder & store"
              />
              <BentoStat
                className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                label={tHub("liveOnStorefront")}
                value={listedLiveCount}
                valueClassName="text-[#10B981] dark:text-emerald-400"
                hint="Visible SKUs shoppers can checkout"
              />
            </div>
          </div>
        </header>

        <div className="dash-tab-track mt-8" role="tablist" aria-label="Main sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "catalog"}
            className={cn("dash-tab", tab === "catalog" ? "dash-tab--active" : "dash-tab--inactive")}
            onClick={() => setTab("catalog")}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Discover
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "store"}
            className={cn("dash-tab", tab === "store" ? "dash-tab--active" : "dash-tab--inactive")}
            onClick={() => setTab("store")}
          >
            <Store className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            My storefront
          </button>
        </div>

        {tab === "catalog" ? (
          <>
            <div className="mt-8 rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/50 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
                    Discover tools
                  </p>
                  <div className="relative max-w-xl">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={discoverQ}
                      onChange={(e) => setDiscoverQ(e.target.value)}
                      placeholder="Search SKU, supplier, tags, category…"
                      className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none ring-violet-500/25 transition placeholder:text-zinc-400 focus:border-violet-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setDiscoverUnlistedOnly((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      discoverUnlistedOnly
                        ? "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-100"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    <Filter className="h-3.5 w-3.5" aria-hidden />
                    Not in my store yet
                  </button>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:min-w-[13rem]">
                  <label htmlFor="discover-sort" className="sr-only">
                    Sort discover feed
                  </label>
                  <div className="relative w-full sm:min-w-[12rem]">
                    <ArrowDownWideNarrow
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                      aria-hidden
                    />
                    <select
                      id="discover-sort"
                      value={discoverSort}
                      onChange={(e) => setDiscoverSort(e.target.value as DiscoverSortKey)}
                      className="w-full appearance-none rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-8 text-sm text-zinc-900 outline-none ring-violet-500/25 focus:border-violet-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-violet-500"
                    >
                      <option value="new">Newest in feed</option>
                      <option value="commission-desc">Partner margin · high → low</option>
                      <option value="price-asc">Supplier price · low → high</option>
                      <option value="price-desc">Supplier price · high → low</option>
                      <option value="name">Title A–Z</option>
                    </select>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-300">
                {catalogLoading ? (
                  <>Loading discover feed…</>
                ) : (
                  <>
                    Showing{" "}
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{filteredDiscover.length}</strong> of{" "}
                    {discoverSkuCount} surfaced SKUs
                    {discoverUnlistedOnly ? <> · hides rows already imported</> : null}
                  </>
                )}
              </p>
            </div>

            {catalogError ? (
              <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/90 px-6 py-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Discover feed unavailable</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-amber-900/80 dark:text-amber-200/80">{catalogError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogLoading(true)
                    setCatalogError(null)
                    void fetch("/api/affiliate/discover-catalog", { credentials: "include" })
                      .then(async (r) => {
                        const data = (await r.json()) as { products?: CatalogProduct[]; error?: string }
                        if (!r.ok) throw new Error(data.error ?? "Could not load catalog")
                        setCatalog(Array.isArray(data.products) ? data.products : [])
                      })
                      .catch((e: unknown) => {
                        setCatalogError(e instanceof Error ? e.message : "Could not load catalog")
                      })
                      .finally(() => setCatalogLoading(false))
                  }}
                  className="mt-4 rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-white"
                >
                  Retry
                </button>
              </div>
            ) : catalogLoading ? (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/80" />
                ))}
              </div>
            ) : filteredDiscover.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
                <BadgePercent className="mx-auto h-10 w-10 text-violet-500" aria-hidden />
                <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">No matches</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-300">
                  Relax filters or clear search—everything in Discover still lives in the{" "}
                  <Link href={AFFILIATE_CATALOG_PATH} className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-400">
                    marketplace
                  </Link>
                  .
                </p>
              </div>
            ) : (
        <section className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredDiscover.map((p) => {
            const listingState = resolveCatalogListingState(p.affiliateProducts)
            const isLive = listingState.kind === "live"
            const isHidden = listingState.kind === "hidden"
            const thumb = primaryProductImage(p.images) || "/placeholder.png"
            const fresh = listingState.kind === "none" && isSkuFresh(p.createdAt)
            const supplierBrand = supplierDisplayLabel(p)
            const supplierHref = p.supplier.store?.slug?.trim()
              ? `/store/supplier/${encodeURIComponent(p.supplier.store.slug)}`
              : null
            const canonicalListingHref = `/product/${p.id}`
            return (
              <article
                id={`catalog-product-${p.id}`}
                key={p.id}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition hover:ring-violet-200/90 dark:bg-zinc-950 dark:hover:ring-violet-900/50",
                  isLive && "ring-emerald-200/90 dark:ring-emerald-900/50",
                  isHidden && "ring-amber-200/90 dark:ring-amber-900/40",
                  !isLive && !isHidden && "ring-gray-100 dark:ring-zinc-800"
                )}
              >
                {isLive ? (
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-xs text-white shadow-sm">
                    <Check className="h-3 w-3" aria-hidden />
                    In your store
                  </div>
                ) : null}
                {isHidden ? (
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-white shadow-sm">
                    Off storefront
                  </div>
                ) : null}
                {listingState.kind === "none" && fresh ? (
                  <div className="pointer-events-none absolute left-3 top-3 z-10">
                    <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                      New
                    </span>
                  </div>
                ) : null}
                <div className="relative aspect-square bg-gradient-to-b from-zinc-50 to-gray-50 p-4 dark:from-zinc-900 dark:to-zinc-950">
                  <Image
                    src={thumb}
                    alt=""
                    fill
                    className="object-contain p-2"
                    sizes="320px"
                    unoptimized={thumb.startsWith("http")}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight text-gray-900 dark:text-zinc-50">
                      {p.name}
                    </p>
                    <Link
                      href={canonicalListingHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Buyer preview — opens PDP when a listing exists"
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-teal-700 transition hover:border-teal-200 hover:bg-teal-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-teal-400 dark:hover:bg-teal-950/40"
                      aria-label="Buyer preview"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                  {(p.categories?.length ?? 0) > 0 ? (
                    <p className="-mt-1 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-300">
                      {(p.categories ?? []).slice(0, 2).join(" · ")}
                    </p>
                  ) : null}
                  {(p.colors?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(p.colors ?? []).slice(0, 8).map((cn) => {
                        const meta = COLORS.find((c) => c.name === cn)
                        const mc = meta ? isMulticolorSwatch(meta) : false
                        return (
                          <span
                            key={cn}
                            title={cn}
                            className="inline-flex h-5 w-5 rounded-full shadow ring-1 ring-black/15"
                            style={
                              mc
                                ? {
                                    background:
                                      "conic-gradient(at 50%_50%,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
                                  }
                                : { backgroundColor: meta?.hex || "#cbd5e1" }
                            }
                          />
                        )
                      })}
                    </div>
                  ) : null}
                  <div className="mt-auto grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                        Supplier price
                      </p>
                      <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900 dark:text-white">
                        {formatStoreCurrencyFromCents(p.basePriceCents)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-[10px] font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400"
                        title="% of resale margin vs supplier price above"
                      >
                        Commission
                      </p>
                      <p className="mt-0.5 text-base font-bold tabular-nums text-violet-700 dark:text-violet-300">
                        {Number.isFinite(p.commissionRate) && p.commissionRate > 0
                          ? `${p.commissionRate}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {supplierHref ? (
                    <Link
                      href={supplierHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="-mt-1 flex max-w-full items-center gap-1 truncate text-xs font-medium text-violet-700 hover:underline dark:text-violet-400"
                    >
                      <Store className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                      <span className="truncate">{supplierBrand}</span>
                    </Link>
                  ) : (
                    <p className="-mt-1 truncate text-xs text-zinc-400 dark:text-zinc-500">{supplierBrand}</p>
                  )}
                  <DiscoverListingActions
                    state={listingState}
                    locale="en"
                    releasing={
                      listingState.kind !== "none" && releasingListingId === listingState.listingId
                    }
                    onAdd={() => void openCreate(p)}
                    onEdit={(listingId) => openEditByListingId(p.id, listingId)}
                    onRelease={releaseDiscoverListing}
                  />
                </div>
              </article>
            )
          })}
        </section>
            )}
          </>
      ) : (
        <section className="mt-8">
          {listingsWithProduct.length ? (
            <div className="mb-6 rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/90 via-white to-violet-50/60 px-5 py-4 shadow-sm dark:border-teal-900/40 dark:from-teal-950/30 dark:via-zinc-950 dark:to-violet-950/30 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-800 dark:text-teal-300">
                  Storefront pulse
                </p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                  Shoppers interacted with{" "}
                  <strong className="font-semibold text-zinc-900 dark:text-white">{insightClicks}</strong> listing views
                  and closed{" "}
                  <strong className="font-semibold text-teal-800 dark:text-teal-200">{insightSales}</strong> conversions
                  on your live SKU rows (all time shown here).
                </p>
              </div>
              <div className="mt-4 flex shrink-0 flex-wrap gap-2 sm:mt-0">
                <Link
                  href={AFFILIATE_CATALOG_PATH}
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-xs font-semibold text-teal-900 shadow-sm hover:bg-teal-50 dark:border-teal-800 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-teal-950/50"
                >
                  <Compass className="h-3.5 w-3.5" aria-hidden />
                  Scout more SKU
                </Link>
              </div>
            </div>
          ) : null}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">
              {storefrontListings.length} live on storefront
              {listingsWithProduct.length > storefrontListings.length
                ? ` · ${listingsWithProduct.length - storefrontListings.length} hidden`
                : ""}
            </p>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => void bulkPatch({ isFeatured: true })}
              className="dash-btn-secondary"
            >
              Feature selected
            </button>
          </div>

          {!storefrontListings.length ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
              No listings yet — add SKUs from <strong className="font-medium text-gray-700 dark:text-zinc-100">Discover</strong>.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ids} strategy={rectSortingStrategy}>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[...storefrontListings].sort(sortAffiliateListingByPosition).map((l) => (
                      <SortableStoreCard
                        key={l.id}
                        listing={l}
                        selected={selected.has(l.id)}
                        onSelect={() =>
                          setSelected((prev) => {
                            const n = new Set(prev)
                            if (n.has(l.id)) n.delete(l.id)
                            else n.add(l.id)
                            return n
                          })
                        }
                        onToggleList={() => void toggleList(l.id, l.isListed)}
                      />
                    ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>
      )}

        <ListingBuilderModal
          open={Boolean(modalProduct)}
          product={modalProduct}
          listing={modalListing}
          storeSlug={storeSlug}
          onClose={() => {
            setModalProduct(null)
            setModalListing(null)
          }}
          onSaved={() => {
            setToast("Saved.")
            void refreshDashboardData()
          }}
        />

        {toast ? (
          <div className="fixed bottom-8 right-8 z-[60] max-w-xs rounded-2xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl">
            {toast}
            <button
              type="button"
              className="mt-2 block text-[11px] text-gray-300 underline"
              onClick={() => setToast(null)}
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
