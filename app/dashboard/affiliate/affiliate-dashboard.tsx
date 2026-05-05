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
  Check,
  Eye,
  GripVertical,
  Pencil,
  TrendingUp,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { AffiliateLiveStore } from "@/components/affiliate/affiliate-live-store"
import {
  ListingBuilderModal,
  type SerializedListing,
} from "@/components/affiliate/listing-builder-modal"
import { COLORS, isMulticolorSwatch } from "@/lib/product-catalog-constants"
import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { primaryProductImage } from "@/lib/product-images"

type CatalogProduct = {
  id: string
  name: string
  description: string
  images: string[]
  categories?: string[]
  colors?: string[]
  tags?: string[]
  variants?: unknown
  basePriceCents: number
  commissionRate: number
  deliveryMax?: number | null
  /** Present on Supplier Catalog query; may be absent on nested `listing.product`. */
  affiliateProducts?: { id: string; isListed: boolean }[]
  supplier: { email: string; store?: { name: string; slug: string } | null }
}

type Listing = SerializedListing & {
  position: number
  product: CatalogProduct | null
}

function sortAffiliateListingByPosition(a: Listing, b: Listing) {
  if (a.position !== b.position) return a.position - b.position
  return a.id.localeCompare(b.id)
}

function fmtEUR(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "EUR",
  })
}

function SortableStoreCard(props: {
  listing: Listing
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onToggleList: () => void
}) {
  const { listing, selected, onSelect, onEdit, onToggleList } = props
  const p = listing.product

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listing.id,
  })

  if (!p) return null

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
      className={`relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition ${
        selected ? "ring-2 ring-green-600" : "ring-gray-100 hover:shadow-md hover:ring-gray-200"
      }`}
    >
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
        {(listing.product?.deliveryMax ?? 99) <= 3 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
            Fast Shipping
          </span>
        ) : null}
        {listing.isFeatured ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
            Featured
          </span>
        ) : null}
      </div>
      <label className="absolute left-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/90 shadow ring-1 ring-gray-100">
        <input type="checkbox" checked={selected} onChange={() => onSelect()} className="h-4 w-4 accent-gray-900" />
      </label>
      <button
        type="button"
        className="absolute left-14 top-3 z-10 flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-lg bg-white/90 text-gray-500 shadow ring-1 ring-gray-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="relative aspect-square bg-gray-50 p-4">
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
          <p className="line-clamp-2 flex-1 text-sm font-semibold leading-snug text-gray-900">{title}</p>
        </div>
        <p className="text-lg font-semibold text-green-600">{fmtEUR(listing.sellingPriceCents)}</p>
        <p className="text-xs text-gray-500">
          {listing.clicks ?? 0} clicks · {listing.conversions ?? 0} sales
        </p>
        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={listing.isListed} onChange={() => void onToggleList()} />
          Listed
        </label>
        <button
          type="button"
          onClick={() => onEdit()}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </button>
      </div>
    </article>
  )
}

type Props = {
  catalog: CatalogProduct[]
  listings: Listing[]
  storeSlug: string | null
}

export function AffiliateDashboard({ catalog: initialCatalog, listings: initialListings, storeSlug }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"catalog" | "store">("catalog")
  const [listings, setListings] = useState<Listing[]>(() =>
    [...initialListings].sort(sortAffiliateListingByPosition)
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [modalProduct, setModalProduct] = useState<CatalogProduct | null>(null)
  const [modalListing, setModalListing] = useState<SerializedListing | null>(null)

  useEffect(() => {
    // Sync when RSC refetches after reorder/save — local state otherwise holds DnD order.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from server props
    setListings([...initialListings].sort(sortAffiliateListingByPosition))
  }, [initialListings])

  const reorderPersist = useCallback(
    async (next: Listing[]) => {
      await fetch("/api/affiliate/products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderedIds: next.map((l) => l.id) }),
      }).catch(() => null)
      router.refresh()
    },
    [router]
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
    router.refresh()
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
    if (opts.isListed === false) setToast("Unlisted selections")
    else if (opts.isFeatured === true) setToast("Featured selections")
    else setToast("Updated selections")
    router.refresh()
  }

  function openCreate(p: CatalogProduct) {
    setModalProduct(p)
    setModalListing(null)
  }

  function openEditModal(productId: string) {
    const listingRow = listings.find((l) => l.productId === productId)
    const p = initialCatalog.find((x) => x.id === productId)
    if (listingRow && p) openEdit(listingRow, p)
  }

  function openEdit(listing: Listing, p: CatalogProduct) {
    setModalProduct(p)
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
      isListed: listing.isListed,
      isFeatured: listing.isFeatured,
    })
  }

  function viewStore() {
    if (!storeSlug) {
      router.push("/dashboard/affiliate/settings/store")
      return
    }
    window.open(`/store/${encodeURIComponent(storeSlug)}`, "_blank", "noopener,noreferrer")
  }

  const ids = listings.map((l) => l.id)

  const liveProductNames = useMemo(() => {
    const fromListings = listings
      .filter((l) => l.product)
      .map((l) => listingDisplayTitle(l.customTitle ?? null, l.product!.name))
    const fromCatalog = initialCatalog.map((p) => p.name)
    return [...new Set([...fromListings, ...fromCatalog])]
  }, [listings, initialCatalog])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Affiliate Store Builder</h1>
          <p className="mt-1 text-sm text-gray-500">Customize listings, SEO, pricing, and your public storefront.</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/affiliate/settings/store")}
            className="mt-3 text-sm font-medium text-green-700 hover:text-green-800"
          >
            Store profile →
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings/social")}
            className="mt-2 block text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Social &amp; community hub →
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings/account")}
            className="mt-2 block text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Account &amp; connected logins →
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AffiliateLiveStore productNames={liveProductNames} storeSlug={storeSlug} />
          <button
            type="button"
            onClick={() => viewStore()}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Eye className="h-4 w-4" /> View My Store
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-2xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl bg-gray-100 p-1">
        <button
          type="button"
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            tab === "catalog" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setTab("catalog")}
        >
          Supplier Catalog
        </button>
        <button
          type="button"
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            tab === "store" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setTab("store")}
        >
          My Store
        </button>
      </div>

      {tab === "catalog" ? (
        <section className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {initialCatalog.map((p) => {
            const isAdded = (p.affiliateProducts?.length ?? 0) > 0
            const thumb = primaryProductImage(p.images) || "/placeholder.png"
            return (
              <article
                key={p.id}
                className={`relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 ${
                  isAdded ? "opacity-60" : ""
                }`}
              >
                {isAdded ? (
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-xs text-white">
                    <Check className="h-3 w-3" aria-hidden />
                    Added
                  </div>
                ) : null}
                <div className="relative aspect-square bg-gray-50 p-4">
                  <Image
                    src={thumb}
                    alt=""
                    fill
                    className="object-contain p-2"
                    sizes="320px"
                    unoptimized={thumb.startsWith("http")}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  {(p.categories?.length ?? 0) > 0 ? (
                    <p className="line-clamp-1 text-[11px] text-blue-700">
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
                  <p className="mt-auto text-sm text-gray-500">Supplier: {fmtEUR(p.basePriceCents)}</p>
                  <p className="text-xs text-gray-400">{p.supplier.email}</p>
                  {isAdded ? (
                    <>
                      <button
                        type="button"
                        disabled
                        className="mt-3 w-full cursor-not-allowed rounded-2xl bg-gray-100 py-3 text-sm font-semibold text-gray-500"
                      >
                        Already in your store
                      </button>
                      <button
                        type="button"
                        className="mt-2 w-full text-sm text-green-600 hover:text-green-700"
                        onClick={() => openEditModal(p.id)}
                      >
                        Edit listing →
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-2xl bg-black py-3 text-sm font-semibold text-white hover:bg-zinc-900"
                      onClick={() => openCreate(p)}
                    >
                      Add to My Store
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <section className="mt-8">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-gray-700">{listings.filter((l) => l.product).length} listings</p>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => void bulkPatch({ isFeatured: true })}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
            >
              Feature selected
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => void bulkPatch({ isListed: false })}
              className="inline-flex items-center gap-1 rounded-xl border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Unlist selected
            </button>
          </div>

          {!listings.filter((l) => l.product).length ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
              No listings yet — add products from Supplier Catalog.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ids} strategy={rectSortingStrategy}>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[...listings]
                    .sort(sortAffiliateListingByPosition)
                    .filter((l): l is Listing & { product: CatalogProduct } => Boolean(l.product))
                    .map((l) => (
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
                        onEdit={() => openEdit(l, l.product)}
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
          router.refresh()
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
    </main>
  )
}
