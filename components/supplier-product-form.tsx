"use client"

import Image from "next/image"
import Link from "next/link"
import type { FormEvent } from "react"
import { useEffect, useRef, useState } from "react"

import { ProductAttributesFields } from "@/components/product-attributes-fields"
import ProductSpecsTable from "@/components/supplier/ProductSpecsTable"
import {
  buildColorImagesFromLegacy,
  catalogHexForColorName,
  parseProductColorImagesFromDb,
  type ProductColorImageRow,
} from "@/lib/product-color-images"
import { variantsFromDb, type ProductVariantsJson } from "@/lib/product-variants"

export type SupplierProductRecord = {
  id: string
  name: string
  description: string
  images: string[]
  categories?: string[]
  colors?: string[]
  tags?: string[]
  variants?: unknown
  colorImages?: unknown
  basePriceCents: number
  compareAt?: number | null
  commissionRate: number
  stock: number
  active?: boolean
  shippingCountry?: string | null
  warehouseType?: string | null
  warehouseCity?: string | null
  processingTime?: number | null
  deliveryMin?: number | null
  deliveryMax?: number | null
  shippingMethods?: string[] | null
  freeShippingThreshold?: number | null
  shippingCost?: number | null
  /** Import pipeline: fulfillment region label when set */
  shipsFrom?: string | null
  deliveryDays?: number | null
  supplierTag?: string | null
}

type FormState = {
  name: string
  description: string
  price: string
  compareAt: string
  commission: string
  stock: string
}

type TaxonomyParent = {
  id: string
  name: string
  icon: string
  subcategories: Array<{ id: string; name: string; slug: string }>
}

type CategoryAttributeRow = {
  id: string
  key: string
  label: string
  type: string
  unit: string | null
  options: string[]
  required: boolean
  order: number
  aiSuggest: boolean
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    price: "",
    compareAt: "",
    commission: "15",
    stock: "0",
  }
}

function mergeColorImageRows(colors: string[], prev: ProductColorImageRow[]): ProductColorImageRow[] {
  const map = new Map(prev.map((r) => [r.color, r]))
  return colors.map((c) => map.get(c) ?? { color: c, hex: catalogHexForColorName(c), image: "" })
}

const STUDIO_STORAGE_KEY = "affisellStudioProcessedImages"

type Props = {
  /** When this id changes, form resets from `initial` */
  resetKey: string
  initial: SupplierProductRecord | null
  onSuccess: () => void
  submitLabelCreate?: string
  submitLabelEdit?: string
}

export function SupplierProductForm({
  resetKey,
  initial,
  onSuccess,
  submitLabelCreate = "Add Product",
  submitLabelEdit = "Save Changes",
}: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [imageUrls, setImageUrls] = useState<string[]>([""])
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [taxonomy, setTaxonomy] = useState<TaxonomyParent[]>([])
  const [taxonomyCategoryId, setTaxonomyCategoryId] = useState<string>("")
  const [specs, setSpecs] = useState<CategoryAttributeRow[]>([])
  const [specValues, setSpecValues] = useState<Record<string, unknown>>({})
  const [variants, setVariants] = useState<ProductVariantsJson | null>(null)
  const [colorImages, setColorImages] = useState<ProductColorImageRow[]>([])
  const [shippingCountry, setShippingCountry] = useState("")
  const [warehouseType, setWarehouseType] = useState<"local" | "regional" | "international">("local")
  const [warehouseCity, setWarehouseCity] = useState("")
  const [processingTime, setProcessingTime] = useState("1")
  const [deliveryMin, setDeliveryMin] = useState("2")
  const [deliveryMax, setDeliveryMax] = useState("5")
  const [methodStandard, setMethodStandard] = useState(true)
  const [methodExpress, setMethodExpress] = useState(false)
  const [methodPickup, setMethodPickup] = useState(false)
  const [freeShippingEUR, setFreeShippingEUR] = useState("")
  const [shippingCostEUR, setShippingCostEUR] = useState("0")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!initial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset entire form when not editing a product
      setForm(emptyForm())
      setImageUrls([""])
      setCategories([])
      setSelectedCategories([])
      setColors([])
      setTags([])
      setVariants(null)
      setColorImages([])
      setShippingCountry("FR")
      setWarehouseType("local")
      setWarehouseCity("")
      setProcessingTime("1")
      setDeliveryMin("2")
      setDeliveryMax("5")
      setMethodStandard(true)
      setMethodExpress(false)
      setMethodPickup(false)
      setFreeShippingEUR("")
      setShippingCostEUR("0")
      setTaxonomyCategoryId("")
      setSpecs([])
      setSpecValues({})
      if (typeof window !== "undefined") {
        const raw = sessionStorage.getItem(STUDIO_STORAGE_KEY)
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as unknown
            if (Array.isArray(parsed)) {
              const studioUrls = parsed
                .filter((u): u is string => typeof u === "string")
                .map((u) => u.trim())
                .filter(Boolean)
                .slice(0, 10)
              if (studioUrls.length) {
                setImageUrls(studioUrls.length < 10 ? [...studioUrls, ""] : studioUrls)
              }
            }
          } catch {
            // ignore malformed studio payload
          } finally {
            sessionStorage.removeItem(STUDIO_STORAGE_KEY)
          }
        }
      }
      return
    }
    const imgs = (initial.images ?? []).map((u) => u.trim()).filter(Boolean)
    setImageUrls(imgs.length > 0 ? imgs : [""])
    setForm({
      name: initial.name,
      description: initial.description ?? "",
      price: (initial.basePriceCents / 100).toFixed(2),
      compareAt:
        typeof initial.compareAt === "number" && Number.isFinite(initial.compareAt) && initial.compareAt > 0
          ? initial.compareAt.toFixed(2)
          : "",
      commission: String(initial.commissionRate),
      stock: String(typeof initial.stock === "number" ? initial.stock : 0),
    })
    setCategories(Array.isArray(initial.categories) ? initial.categories : [])
    setSelectedCategories(Array.isArray(initial.categories) ? initial.categories : [])
    setColors(Array.isArray(initial.colors) ? initial.colors : [])
    setTags(Array.isArray(initial.tags) ? initial.tags : [])
    setVariants(variantsFromDb(initial.variants))
    const colorsArr = Array.isArray(initial.colors) ? initial.colors : []
    const fromDb = parseProductColorImagesFromDb(initial.colorImages)
    if (fromDb?.length) {
      setColorImages(mergeColorImageRows(colorsArr, fromDb))
    } else {
      setColorImages(buildColorImagesFromLegacy(colorsArr, initial.variants))
    }
    setShippingCountry((initial.shippingCountry ?? "FR").toUpperCase())
    const wt = initial.warehouseType?.toLowerCase()
    setWarehouseType(
      wt === "regional" || wt === "international" ? wt : "local"
    )
    setWarehouseCity(initial.warehouseCity ?? "")
    setProcessingTime(String(initial.processingTime ?? 1))
    setDeliveryMin(String(initial.deliveryMin ?? 2))
    setDeliveryMax(String(initial.deliveryMax ?? 5))
    const m = initial.shippingMethods ?? []
    setMethodStandard(m.includes("standard") || m.length === 0)
    setMethodExpress(m.includes("express"))
    setMethodPickup(m.includes("pickup"))
    setTaxonomyCategoryId(typeof (initial as any).categoryId === "string" ? (initial as any).categoryId : "")
    setSpecs([])
    setSpecValues({})
    setFreeShippingEUR(
      initial.freeShippingThreshold != null && Number(initial.freeShippingThreshold) > 0
        ? String(Number(initial.freeShippingThreshold))
        : ""
    )
    setShippingCostEUR(
      initial.shippingCost != null && Number(initial.shippingCost) > 0
        ? String(Number(initial.shippingCost))
        : "0"
    )

    const isImport =
      (initial.supplierTag ?? "").toLowerCase() === "import" ||
      (Array.isArray(initial.tags) &&
        initial.tags.some((t) => (t ?? "").toLowerCase() === "imported"))

    if (isImport) {
      const from = (initial.shipsFrom ?? "").trim().toLowerCase()

      if (
        /\bchina\b|^cn\b|hong kong|aliexpress|cny\b/.test(from) ||
        /\bchina\b|aliexpress/i.test((initial.description ?? "").toLowerCase())
      ) {
        setShippingCountry("CN")
        setWarehouseType("international")
      } else if (/\bunited states\b|usa|^us\b|amazon\b/.test(from)) {
        setShippingCountry("US")
        setWarehouseType("international")
      } else if (from.length > 0 && !/^france|fr\b/.test(from)) {
        setWarehouseType("international")
      }

      const days = typeof initial.deliveryDays === "number" ? initial.deliveryDays : 0
      if (days > 0 && days < 365) {
        setDeliveryMin(String(Math.max(1, Math.floor(days * 0.85))))
        setDeliveryMax(String(Math.ceil(days * 1.15)))
      }
    }
  }, [resetKey, initial])

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: { categories?: TaxonomyParent[] }) => {
        if (Array.isArray(data.categories)) setTaxonomy(data.categories)
      })
      .catch(() => setTaxonomy([]))
  }, [])

  useEffect(() => {
    if (!taxonomyCategoryId) {
      setSpecs([])
      setSpecValues({})
      return
    }
    fetch(`/api/categories/${taxonomyCategoryId}/attributes`)
      .then((r) => r.json())
      .then((data: { attributes?: CategoryAttributeRow[] }) => {
        setSpecs(Array.isArray(data.attributes) ? data.attributes : [])
      })
      .catch(() => setSpecs([]))
  }, [taxonomyCategoryId])

  useEffect(() => {
    const name = form.name.trim()
    if (!name || name.length < 3) return
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/categorize-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: name }),
        })
        const data = (await res.json()) as { categories?: string[] }
        const next = Array.isArray(data.categories) ? data.categories.slice(0, 3) : []
        if (next.length > 0) {
          setSelectedCategories(next)
          setCategories(next)
        }
      } catch {
        // non-blocking suggestion feature
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [form.name])

  useEffect(() => {
    const firstImageUrl = imageUrls.map((u) => u.trim()).find((u) => /^https?:\/\//i.test(u))
    if (!firstImageUrl) return
    const name = form.name.trim()
    const run = async () => {
      try {
        const res = await fetch("/api/categorize-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: name, imageUrl: firstImageUrl }),
        })
        const data = (await res.json()) as { categories?: string[] }
        const next = Array.isArray(data.categories) ? data.categories.slice(0, 3) : []
        if (next.length > 0) {
          setSelectedCategories(next)
          setCategories(next)
        }
      } catch {
        // non-blocking suggestion feature
      }
    }
    void run()
  }, [imageUrls, form.name])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const images = imageUrls
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => !s.startsWith("blob:"))
        .slice(0, 10)
      const rows = mergeColorImageRows(colors, colorImages).map((r) => ({
        color: r.color,
        hex: r.hex,
        image: r.image.startsWith("blob:") ? "" : r.image.trim(),
      }))
      const shippingMethods: string[] = []
      if (methodStandard) shippingMethods.push("standard")
      if (methodExpress) shippingMethods.push("express")
      if (methodPickup) shippingMethods.push("pickup")

      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        images,
        categories,
        colors,
        tags,
        variants: variants ?? undefined,
        colorImages: rows.length ? rows : [],
        price: Number(form.price),
        compareAt: form.compareAt.trim() === "" ? null : Number(form.compareAt),
        commission: Number(form.commission),
        stock: Number(form.stock),
        categoryId: taxonomyCategoryId || undefined,
        productAttributes: specs
          .map((a) => {
            const v = specValues[a.key]
            if (v == null) return null
            const value = Array.isArray(v) ? v.map(String).join(", ") : String(v)
            const trimmed = value.trim()
            if (!trimmed) return null
            return { key: a.key, label: a.label, value: trimmed }
          })
          .filter(Boolean),
        shippingCountry: shippingCountry.trim() || undefined,
        warehouseType,
        warehouseCity: warehouseCity.trim(),
        processingTime: Math.round(Number(processingTime)) || 1,
        deliveryMin: Math.round(Number(deliveryMin)) || 2,
        deliveryMax: Math.round(Number(deliveryMax)) || 5,
        shippingMethods,
        freeShippingThresholdEUR: freeShippingEUR.trim() === "" ? null : Number(freeShippingEUR),
        shippingCostEUR: Number(shippingCostEUR) || 0,
      }

      if (!body.name) throw new Error("Name is required")
      if (!Number.isFinite(body.price) || body.price < 0) throw new Error("Invalid price")
      if (body.compareAt != null) {
        if (!Number.isFinite(body.compareAt) || body.compareAt <= 0) {
          throw new Error("Invalid compare-at price")
        }
        if (body.compareAt <= body.price) {
          throw new Error("Compare-at price must be greater than price")
        }
        const discountPct = ((body.compareAt - body.price) / body.compareAt) * 100
        if (discountPct > 70) {
          throw new Error("Discount cannot exceed 70%")
        }
      }

      if (initial) {
        const res = await fetch(`/api/supplier/products/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
        const json = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(json.error ?? "Failed")
      } else {
        const res = await fetch("/api/supplier/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        })
        const json = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(json.error ?? "Failed")
      }

      imageUrls.forEach((u) => {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u)
      })
      colorImages.forEach((r) => {
        if (r.image.startsWith("blob:")) URL.revokeObjectURL(r.image)
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">{initial ? "Edit Product" : "Add Product"}</h2>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          required
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          required
          name="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Base price (EUR)"
          value={form.price}
          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="compareAt"
          type="number"
          step="0.01"
          min="0"
          placeholder="Compare-at price (optional)"
          value={form.compareAt}
          onChange={(e) => setForm((f) => ({ ...f, compareAt: e.target.value }))}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="md:col-span-2 grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-sm font-semibold">Technical Specifications</p>
          <select
            value={taxonomyCategoryId}
            onChange={(e) => setTaxonomyCategoryId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Select a subcategory…</option>
            {taxonomy.flatMap((parent) =>
              parent.subcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {parent.name} → {sub.name}
                </option>
              ))
            )}
          </select>
          {taxonomyCategoryId ? (
            <ProductSpecsTable
              categoryId={taxonomyCategoryId}
              productTitle={form.name}
              onSpecsChange={setSpecValues}
            />
          ) : null}
          {taxonomyCategoryId && specs.length === 0 ? (
            <p className="text-xs text-zinc-500">No spec schema seeded for this subcategory yet.</p>
          ) : null}
        </div>
        {initial &&
        ((initial.supplierTag ?? "").toLowerCase() === "import" ||
          (initial.tags ?? []).some(
            (t) => String(t ?? "").toLowerCase() === "imported"
          )) ? (
          <p className="md:col-span-2 rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-100">
            <span className="font-medium">Imported listing.</span>{" "}
            {typeof initial.shipsFrom === "string" && initial.shipsFrom.trim()
              ? `Ship region: ${initial.shipsFrom.trim()}. `
              : null}
            {typeof initial.description === "string"
              ? (() => {
                  const raw = initial.description.split("\n")
                  const clip = raw.find((l) => /supplier cost reference/i.test(l))
                  return clip ? `${clip.trim()}. ` : ""
                })()
              : null}
            Refine logistics below if needed — values were estimated from import.
          </p>
        ) : null}
        <div className="flex flex-col">
          <label className="flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Offered Commission
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
              For Affiliates
            </span>
          </label>
          <input
            name="commission"
            type="number"
            min={1}
            max={50}
            placeholder="15"
            value={form.commission}
            onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Affiliates earn this % per sale</p>
        </div>
        <input
          name="stock"
          type="number"
          min="0"
          step="1"
          placeholder="Stock"
          value={form.stock}
          onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />

        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Product Images (up to 10)
          </label>
          <Link
            href="/seller/photo-studio"
            className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-700/60 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-900/60"
          >
            Enhance Photos in Affisell Studio
          </Link>
          {imageUrls.map((url, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  const newUrls = [...imageUrls]
                  newUrls[index] = e.target.value
                  setImageUrls(newUrls)
                }}
                placeholder={`Image URL ${index + 1} (https://...)`}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
              {imageUrls.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = imageUrls.filter((_, i) => i !== index)
                    setImageUrls(next.length ? next : [""])
                  }}
                  className="rounded-lg px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {imageUrls.length < 10 ? (
            <button
              type="button"
              onClick={() => setImageUrls([...imageUrls, ""])}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              + Add another URL
            </button>
          ) : null}
          <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
              Upload from your device for local preview only. Use HTTPS image URLs above to publish images to
              shoppers.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading || busy}
              className="sr-only"
              aria-label="Choose image files"
              onChange={(e) => {
                const cap = Math.max(0, 10 - imageUrls.filter(Boolean).length)
                const files = Array.from(e.target.files || []).slice(0, cap)
                if (files.length === 0) return
                setUploading(true)
                try {
                  const urls = files.map((f) => URL.createObjectURL(f))
                  const merged = [...imageUrls.map((s) => s.trim()).filter(Boolean), ...urls].slice(0, 10)
                  setImageUrls(merged.length < 10 ? [...merged, ""] : merged)
                } finally {
                  setUploading(false)
                  e.target.value = ""
                }
              }}
            />
            <button
              type="button"
              disabled={uploading || busy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Choose files
            </button>
          </div>
          {imageUrls.filter(Boolean).length > 0 ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {imageUrls.filter(Boolean).map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-square overflow-hidden rounded-lg bg-gray-50 dark:bg-zinc-800"
                >
                  <Image src={url} alt="" fill className="object-contain p-1" sizes="80px" unoptimized />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <textarea
          name="description"
          placeholder="Description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="md:col-span-2 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />

        <div className="md:col-span-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Shipping &amp; Delivery</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Accurate shipping settings help affiliates and buyers trust delivery times.
          </p>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Ship from country</label>
            <select
              value={shippingCountry}
              onChange={(e) => setShippingCountry(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            >
              <option value="FR">🇫🇷 FR — France</option>
              <option value="DE">🇩🇪 DE — Germany</option>
              <option value="ES">🇪🇸 ES — Spain</option>
              <option value="IT">🇮🇹 IT — Italy</option>
              <option value="US">🇺🇸 US — United States</option>
              <option value="CN">🇨🇳 CN — China</option>
              <option value="UK">🇬🇧 UK — United Kingdom</option>
            </select>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Warehouse type</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950">
                <input
                  type="radio"
                  name="warehouseType"
                  checked={warehouseType === "local"}
                  onChange={() => setWarehouseType("local")}
                />
                <span>Local (same country)</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                  Local
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950">
                <input
                  type="radio"
                  name="warehouseType"
                  checked={warehouseType === "regional"}
                  onChange={() => setWarehouseType("regional")}
                />
                <span>Regional (EU)</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                  EU
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950">
                <input
                  type="radio"
                  name="warehouseType"
                  checked={warehouseType === "international"}
                  onChange={() => setWarehouseType("international")}
                />
                <span>International</span>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                  Global
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Warehouse city</label>
            <input
              type="text"
              placeholder="Paris"
              value={warehouseCity}
              onChange={(e) => setWarehouseCity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Processing time</label>
              <p className="mt-1 text-xs text-zinc-500">Ships within the number of days below.</p>
              <input
                type="number"
                min={1}
                max={30}
                value={processingTime}
                onChange={(e) => setProcessingTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Ships within{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{processingTime || "1"}</span>{" "}
                {Number(processingTime) === 1 ? "day" : "days"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Delivery estimate</label>
              <p className="mt-1 text-xs text-zinc-500">Business days after dispatch.</p>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={deliveryMin}
                  onChange={(e) => setDeliveryMin(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={deliveryMax}
                  onChange={(e) => setDeliveryMax(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Delivers in{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{deliveryMin || "2"}</span> to{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{deliveryMax || "5"}</span> business
                days
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Shipping methods</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={methodStandard}
                  onChange={(e) => setMethodStandard(e.target.checked)}
                />
                Standard
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={methodExpress}
                  onChange={(e) => setMethodExpress(e.target.checked)}
                />
                Express (24h)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={methodPickup}
                  onChange={(e) => setMethodPickup(e.target.checked)}
                />
                Local Pickup
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Free shipping over (€)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="50"
                value={freeShippingEUR}
                onChange={(e) => setFreeShippingEUR(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Default shipping cost (€)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={shippingCostEUR}
                onChange={(e) => setShippingCostEUR(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </div>
          </div>
        </div>

        <ProductAttributesFields
          categories={categories}
          selectedCategories={selectedCategories}
          onSelectedCategoriesChange={(next) => {
            setSelectedCategories(next)
            setCategories(next)
          }}
          onCategoriesChange={(next) => {
            setSelectedCategories(next)
            setCategories(next)
          }}
          colors={colors}
          tags={tags}
          onTagsChange={setTags}
          variants={variants}
          onVariantsChange={setVariants}
          productTitle={form.name}
          basePriceEUR={form.price}
          defaultCommission={form.commission}
          mainImage={imageUrls.map((s) => s.trim()).find(Boolean) ?? ""}
        />

        <button
          type="submit"
          disabled={busy || uploading}
          className="md:col-span-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Saving…" : initial ? submitLabelEdit : submitLabelCreate}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  )
}
