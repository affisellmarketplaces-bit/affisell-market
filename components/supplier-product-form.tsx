"use client"

import Image from "next/image"
import Link from "next/link"
import type { FormEvent } from "react"
import { useEffect, useRef, useState } from "react"

import { ProductAttributesFields } from "@/components/product-attributes-fields"
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
}

type FormState = {
  name: string
  description: string
  price: string
  commission: string
  stock: string
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    price: "",
    commission: "20",
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
  const [colors, setColors] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
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
      commission: String(initial.commissionRate),
      stock: String(typeof initial.stock === "number" ? initial.stock : 0),
    })
    setCategories(Array.isArray(initial.categories) ? initial.categories : [])
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
  }, [resetKey, initial])

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
        commission: Number(form.commission),
        stock: Number(form.stock),
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
          name="commission"
          type="number"
          min="1"
          max="99"
          placeholder="Commission % of margin"
          value={form.commission}
          onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
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
          onCategoriesChange={setCategories}
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
