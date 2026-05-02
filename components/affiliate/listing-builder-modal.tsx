"use client"

import type { FormEvent, MouseEvent } from "react"
import { useMemo, useState } from "react"

type CatalogProduct = {
  id: string
  name: string
  description: string
  images: string[]
  basePriceCents: number
}

export type SerializedListing = {
  id: string
  productId: string
  sellingPriceCents: number
  customTitle?: string | null
  customDescription?: string | null
  customImages: string[]
  customSlug?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  collections: string[]
  isListed: boolean
  isFeatured?: boolean
  clicks?: number
  conversions?: number
  position?: number
}

type Props = {
  open: boolean
  product: CatalogProduct | null
  listing: SerializedListing | null
  storeSlug: string | null
  onClose: () => void
  onSaved: () => void
}

const COLLECTIONS = ["Featured", "Black Friday", "Tech Deals"] as const

type FormFields = {
  step: 1 | 2
  customTitle: string
  customDescription: string
  useAllSupplierImages: boolean
  imagePick: Record<string, boolean>
  extraUrls: string
  priceEUR: string
  selectedCollections: Record<string, boolean>
  customSlug: string
  seoTitle: string
  seoDesc: string
  listInStore: boolean
}

function getListingFormDefaults(
  product: CatalogProduct,
  listing: SerializedListing | null
): Omit<FormFields, "step"> {
  const urls = product.images?.filter(Boolean) ?? []
  const L = listing
  const imagePick: Record<string, boolean> = {}
  urls.forEach((u) => {
    imagePick[u] = Boolean(L?.customImages?.includes(u))
  })
  const selectedCollections: Record<string, boolean> = {}
  COLLECTIONS.forEach((c) => {
    selectedCollections[c] = L?.collections.includes(c) ?? false
  })
  return {
    customTitle: L?.customTitle ?? "",
    customDescription: L?.customDescription ?? product.description ?? "",
    useAllSupplierImages: !L || L.customImages.length === 0,
    imagePick,
    extraUrls: L?.customImages.filter((u) => !urls.includes(u)).join("\n") ?? "",
    priceEUR:
      L?.sellingPriceCents != null
        ? (L.sellingPriceCents / 100).toFixed(2)
        : (product.basePriceCents / 100).toFixed(2),
    selectedCollections,
    customSlug: L?.customSlug ?? "",
    seoTitle: L?.seoTitle ?? "",
    seoDesc: L?.seoDescription ?? "",
    listInStore: L ? L.isListed : true,
  }
}

type BodyProps = {
  product: CatalogProduct
  listing: SerializedListing | null
  storeSlug: string | null
  onClose: () => void
  onSaved: () => void
}

function ListingBuilderModalBody({ product, listing, storeSlug, onClose, onSaved }: BodyProps) {
  const supplierUrls = useMemo(() => product.images?.filter(Boolean) ?? [], [product.images])
  const [form, setForm] = useState<FormFields>(() => ({
    step: 1,
    ...getListingFormDefaults(product, listing),
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)

  const marginEUR = useMemo(() => {
    const pp = Number(String(form.priceEUR).replace(",", "."))
    if (!Number.isFinite(pp)) return null
    return pp - product.basePriceCents / 100
  }, [form.priceEUR, product])

  function toggleCollection(c: string) {
    setForm((f) => ({
      ...f,
      selectedCollections: { ...f.selectedCollections, [c]: !f.selectedCollections[c] },
    }))
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setUploadBusy(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, 5)) {
        const fd = new FormData()
        fd.set("file", file)
        const res = await fetch("/api/affiliate/uploads", { method: "POST", body: fd, credentials: "include" })
        const j = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed")
        urls.push(typeof window !== "undefined" ? `${window.location.origin}${j.url}` : j.url)
      }
      setForm((f) => ({
        ...f,
        extraUrls: (f.extraUrls.trim() ? `${f.extraUrls.trim()}\n` : "") + urls.join("\n"),
      }))
    } finally {
      setUploadBusy(false)
    }
  }

  function buildCollectionsArray() {
    return COLLECTIONS.filter((c) => form.selectedCollections[c])
  }

  function builtCustomImages(): string[] {
    const extras = form.extraUrls
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
    const subset = form.useAllSupplierImages
      ? supplierUrls
      : supplierUrls.filter((u) => form.imagePick[u])
    const merged = [...subset, ...extras]
    const seen = new Set<string>()
    return merged.filter((u) => (seen.has(u) ? false : (seen.add(u), true))).slice(0, 20)
  }

  async function submit(saveDraft: boolean) {
    setBusy(true)
    setError(null)
    try {
      const collections = buildCollectionsArray()
      const euro = Number(String(form.priceEUR).replace(",", "."))

      if (listing?.id) {
        const bodyObj: Record<string, unknown> = {
          sellingPriceEUR: euro,
          customTitle: form.customTitle.trim(),
          customDescription: form.customDescription.trim(),
          customImages: builtCustomImages(),
          collections,
          customSlug: form.customSlug.trim(),
          seoTitle: form.seoTitle.trim(),
          seoDescription: form.seoDesc.trim(),
          isListed: saveDraft ? false : form.listInStore,
          isFeatured: collections.includes("Featured"),
        }
        const res = await fetch(`/api/affiliate/products/${listing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(bodyObj),
        })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(j.error ?? "Save failed")
      } else {
        const extrasParsed = form.extraUrls
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean)
        const supplierSelected = supplierUrls.filter((u) => form.imagePick[u])

        const bodyObj: Record<string, unknown> = {
          productId: product.id,
          sellingPriceEUR: euro,
          customTitle: form.customTitle.trim(),
          customDescription: form.customDescription.trim(),
          supplierImagesSelectedUrls: form.useAllSupplierImages ? undefined : supplierSelected,
          useAllSupplierImages: form.useAllSupplierImages,
          additionalImageUrls: extrasParsed,
          collections,
          customSlug: form.customSlug.trim(),
          seoTitle: form.seoTitle.trim(),
          seoDescription: form.seoDesc.trim(),
          listInStore: form.listInStore,
          saveDraft,
          publish: !saveDraft,
          publishToStore: !saveDraft,
        }

        const res = await fetch("/api/affiliate/products/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(bodyObj),
        })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(j.error ?? "Could not create listing")
      }

      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
  }

  const baseEUR = product.basePriceCents / 100

  return (
    <div
      className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Add to My Store</p>
          <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="flex max-h-[calc(90vh-4rem)] flex-col">
        <div className="flex gap-2 border-b border-gray-50 px-6 py-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, step: 1 }))}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              form.step === 1 ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            1 Customize
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, step: 2 }))}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              form.step === 2 ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            2 SEO &amp; Visibility
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {form.step === 1 ? (
            <>
              <div>
                <label className="text-sm font-medium text-gray-800">Custom Title</label>
                <input
                  value={form.customTitle}
                  onChange={(e) => setForm((f) => ({ ...f, customTitle: e.target.value }))}
                  placeholder={product.name}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none ring-gray-900 focus:ring-2"
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank to use original</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">Custom Description</label>
                <textarea
                  value={form.customDescription}
                  onChange={(e) => setForm((f) => ({ ...f, customDescription: e.target.value }))}
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder={product.description?.slice(0, 280)}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input
                    type="checkbox"
                    checked={form.useAllSupplierImages}
                    onChange={(e) => setForm((f) => ({ ...f, useAllSupplierImages: e.target.checked }))}
                  />
                  Use all supplier images
                </label>
                {!form.useAllSupplierImages ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {supplierUrls.map((u) => (
                      <label key={u} className="relative rounded-lg border border-gray-100 p-1">
                        <input
                          type="checkbox"
                          checked={Boolean(form.imagePick[u])}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              imagePick: { ...f.imagePick, [u]: !f.imagePick[u] },
                            }))
                          }
                          className="absolute right-2 top-2 rounded"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u || "/placeholder.png"} alt="" className="aspect-square rounded-md object-contain" />
                      </label>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-sm font-medium text-gray-800">Additional image URLs</p>
                <textarea
                  value={form.extraUrls}
                  onChange={(e) => setForm((f) => ({ ...f, extraUrls: e.target.value }))}
                  rows={3}
                  placeholder="https://… one per line"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-gray-900"
                />
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                  Upload PNG / JPEG
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    className="hidden"
                    disabled={uploadBusy}
                    onChange={(e) => void uploadFiles(e.target.files)}
                  />
                </label>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">Custom Price (EUR)</label>
                <div className="mt-1 rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-600">
                    Supplier: €{baseEUR.toFixed(2)} | Your price:{" "}
                    <input
                      type="number"
                      step={0.01}
                      min={baseEUR}
                      value={form.priceEUR}
                      onChange={(e) => setForm((f) => ({ ...f, priceEUR: e.target.value }))}
                      className="w-28 rounded border border-gray-200 px-2 py-1 text-green-700"
                    />{" "}
                    | Margin:{" "}
                    <span className="font-semibold text-green-600">
                      {marginEUR != null && Number.isFinite(marginEUR) ? `€${marginEUR.toFixed(2)}` : "—"}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-800">Collections</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLLECTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCollection(c)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                        form.selectedCollections[c]
                          ? "bg-gray-900 text-white ring-gray-900"
                          : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-gray-800">URL slug</label>
                <div className="mt-1 flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm text-gray-600">
                  <span className="text-gray-400">/store/</span>
                  <span className="text-gray-900">{storeSlug ?? "your-store-slug"}</span>
                  <span className="text-gray-400">/</span>
                  <input
                    value={form.customSlug}
                    onChange={(e) => setForm((f) => ({ ...f, customSlug: e.target.value }))}
                    placeholder="listing-slug"
                    className="min-w-[8rem] flex-1 rounded border-none bg-transparent p-0 text-gray-900 outline-none"
                  />
                </div>
                {!storeSlug ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Finish your Store Profile to set /store/[your slug]
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">SEO Title (max 60)</label>
                <input
                  value={form.seoTitle}
                  maxLength={60}
                  onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-400">{form.seoTitle.length}/60</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">Meta Description (max 160)</label>
                <textarea
                  value={form.seoDesc}
                  maxLength={160}
                  rows={3}
                  onChange={(e) => setForm((f) => ({ ...f, seoDesc: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-400">{form.seoDesc.length}/160</p>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-900">List in my store</span>
                <input
                  type="checkbox"
                  checked={form.listInStore}
                  onChange={(e) => setForm((f) => ({ ...f, listInStore: e.target.checked }))}
                  className="h-5 w-5 accent-gray-900"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 bg-white px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit(true)}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit(false)}
            className="ml-auto rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            Publish to Store
          </button>
        </div>
      </form>
    </div>
  )
}

export function ListingBuilderModal({ open, product, listing, storeSlug, onClose, onSaved }: Props) {
  function onOverlayDown(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).dataset?.overlay === "1") onClose()
  }

  if (!open || !product) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      data-overlay="1"
      onMouseDown={onOverlayDown}
    >
      <ListingBuilderModalBody
        key={`${product.id}-${listing?.id ?? "new"}`}
        product={product}
        listing={listing}
        storeSlug={storeSlug}
        onClose={onClose}
        onSaved={onSaved}
      />
    </div>
  )
}
