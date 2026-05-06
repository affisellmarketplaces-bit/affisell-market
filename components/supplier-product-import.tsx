"use client"

import { Box, CloudUpload, Link2, ShoppingBag } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ChangeEvent } from "react"
import { useCallback, useState } from "react"

export type ImportedVariantDraft = {
  name: string
  image: string
  price: number
  stock: number
  type?: string
  sku?: string
}

export type ImportedColorDraft = {
  name: string
  hex: string
  image: string
}

export type ImportShippingDraft = {
  from_country: string
  delivery_time: string
  shipping_cost: number
  processing_time: string
  carrier?: string
}

/** Precision import preview row (URL scrape or normalized CSV mock). */
export type ImportReviewItemDraft = {
  rating: number
  author: string
  country: string
  date: string
  text: string
  images: string[]
  variant: string
  helpful_count: number
  verified: boolean
}

export type ImportReviewsDraft = {
  total: number
  average_rating: number
  breakdown: { 5: number; 4: number; 3: number; 2: number; 1: number }
  items: ImportReviewItemDraft[]
}

export type ImportPreviewRow = {
  title: string
  price: number
  original_price: number
  suggested_price: number
  suggested_commission: number
  profit_per_sale: string
  basePrice?: number
  currency: string
  images: string[]
  image: string
  description: string
  variants: ImportedVariantDraft[]
  variants_count: number
  colors: ImportedColorDraft[]
  sizes: string[]
  sizes_objects: Array<{ name: string; value: string }>
  shipping: ImportShippingDraft
  specs: Record<string, string>
  reviews?: ImportReviewsDraft
  tags: string[]
  stock: number
  sku: string
  source_url: string
  category: string
  selected?: boolean
}

type ImportMethod = "csv" | "url" | "shopify" | "aliexpress"

const TAB_ICONS: Record<ImportMethod, typeof CloudUpload> = {
  csv: CloudUpload,
  url: Link2,
  shopify: ShoppingBag,
  aliexpress: Box,
}

const DEFAULT_IMPORT_MARKUP = 1.7
const DEFAULT_IMPORT_COMMISSION = 25

function num(raw: unknown, fallback = 0): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const n = parseFloat(String(raw ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : fallback
}

function normalizeImportPreviewRow(raw: Record<string, unknown>): ImportPreviewRow {
  const title =
    typeof raw.title === "string"
      ? raw.title
      : typeof raw.name === "string"
        ? raw.name
        : ""

  const priceBase = num(raw.price, 0)
  let suggestedPrice = num(raw.suggested_price, 0)
  if (!(suggestedPrice > 0) && priceBase > 0) {
    suggestedPrice = Math.round(priceBase * DEFAULT_IMPORT_MARKUP * 100) / 100
  }

  let variants: ImportedVariantDraft[] = []
  if (Array.isArray(raw.variants)) {
    variants = raw.variants
      .map((item): ImportedVariantDraft | null => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null
        const v = item as Record<string, unknown>
        const nm = typeof v.name === "string" ? v.name.trim().slice(0, 200) : ""
        if (!nm) return null
        const vtRaw = typeof v.type === "string" ? v.type.trim().slice(0, 120) : ""
        const display = vtRaw ? `${vtRaw}: ${nm}`.slice(0, 200) : nm
        const line: ImportedVariantDraft = {
          name: display,
          image: typeof v.image === "string" ? v.image.trim() : "",
          price: num(v.price, priceBase),
          stock: Math.max(0, Math.round(num(v.stock, num(raw.stock, 99)))),
        }
        if (vtRaw) line.type = vtRaw
        const sku = typeof v.sku === "string" ? v.sku.trim().slice(0, 120) : ""
        if (sku) line.sku = sku
        return line
      })
      .filter((x): x is ImportedVariantDraft => x !== null)
  }

  const legacyVariantCount =
    typeof raw.variants_count === "number" && Number.isFinite(raw.variants_count)
      ? Math.max(1, Math.round(raw.variants_count))
      : typeof raw.variants === "number"
        ? Math.max(1, Math.round(Number(raw.variants)))
        : 1

  const variants_count = variants.length > 0 ? variants.length : legacyVariantCount

  const imgs: string[] = Array.isArray(raw.images)
    ? raw.images.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : []
  const image =
    typeof raw.image === "string" ? raw.image.trim() : imgs[0] ?? ""

  const desc =
    typeof raw.description === "string" ? raw.description : ""

  let colors: ImportedColorDraft[] = []
  if (Array.isArray(raw.colors)) {
    colors = raw.colors
      .map((c): ImportedColorDraft | null => {
        if (typeof c === "string" && c.trim()) {
          const n = c.trim().slice(0, 120)
          return { name: n, hex: "#CCCCCC", image: "" }
        }
        if (!c || typeof c !== "object" || Array.isArray(c)) return null
        const o = c as Record<string, unknown>
        const n = typeof o.name === "string" ? o.name.trim().slice(0, 120) : ""
        if (!n) return null
        return {
          name: n,
          hex:
            typeof o.hex === "string" ? o.hex.trim().slice(0, 24) : "#CCCCCC",
          image: typeof o.image === "string" ? o.image.trim().slice(0, 2000) : "",
        }
      })
      .filter((x): x is ImportedColorDraft => x !== null)
  }

  const sizes: string[] = []
  const sizes_objects: Array<{ name: string; value: string }> = []
  const seenSizeVal = new Set<string>()

  const pushSize = (nameRaw: string, valueRaw?: string) => {
    const name = nameRaw.trim().slice(0, 120)
    const value = (valueRaw ?? name).trim().slice(0, 120)
    if (!name && !value) return
    const key = `${value}:${name}`
    if (seenSizeVal.has(key)) return
    seenSizeVal.add(key)
    sizes.push(value || name)
    sizes_objects.push({
      name: name || value,
      value: value || name,
    })
  }

  const mergeSizesArrays = (arr: unknown[]) => {
    for (const x of arr) {
      if (typeof x === "string") {
        pushSize(x, x)
        continue
      }
      if (!x || typeof x !== "object" || Array.isArray(x)) continue
      const o = x as Record<string, unknown>
      const nm = typeof o.name === "string" ? o.name : ""
      const val = typeof o.value === "string" ? o.value : ""
      if (nm || val) pushSize(nm || val, val || nm)
    }
  }

  if (Array.isArray(raw.sizes)) mergeSizesArrays(raw.sizes as unknown[])
  if (Array.isArray(raw.sizes_objects))
    mergeSizesArrays(raw.sizes_objects as unknown[])

  let shipping: ImportShippingDraft = {
    from_country: "China",
    delivery_time: "15–25 days",
    shipping_cost: 0,
    processing_time: "1–3 days",
    carrier: "Colissimo",
  }
  const shRaw = raw.shipping
  if (shRaw && typeof shRaw === "object" && !Array.isArray(shRaw)) {
    const o = shRaw as Record<string, unknown>
    shipping = {
      from_country:
        typeof o.from_country === "string" ? o.from_country.trim().slice(0, 160) : shipping.from_country,
      delivery_time:
        typeof o.delivery_time === "string"
          ? o.delivery_time.trim().slice(0, 200)
          : shipping.delivery_time,
      shipping_cost: num(o.shipping_cost, 0),
      processing_time:
        typeof o.processing_time === "string"
          ? o.processing_time.trim().slice(0, 200)
          : shipping.processing_time,
      carrier:
        typeof o.carrier === "string" && o.carrier.trim().length > 0
          ? o.carrier.trim().slice(0, 120)
          : shipping.carrier,
    }
  }

  let specs: Record<string, string> = {}
  const specsRaw = raw.specs
  if (
    specsRaw &&
    typeof specsRaw === "object" &&
    !Array.isArray(specsRaw)
  ) {
    for (const [k, val] of Object.entries(specsRaw as Record<string, unknown>))
      specs[k.slice(0, 200)] = String(val ?? "").slice(0, 800)
    if (Object.keys(specs).length > 240) specs = Object.fromEntries(Object.entries(specs).slice(0, 240))
  }

  const tagsRaw = raw.tags
  const tags: string[] = Array.isArray(tagsRaw)
    ? tagsRaw
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 40))
    : []

  const suggested_commission = Math.min(
    50,
    Math.max(1, Math.round(num(raw.suggested_commission, DEFAULT_IMPORT_COMMISSION)))
  )

  const profitParsed =
    typeof raw.profit_per_sale === "string"
      ? raw.profit_per_sale.trim()
      : ""
  const profit_per_sale =
    profitParsed ||
    Math.max(
      suggestedPrice - priceBase,
      0
    ).toFixed(2)

  let reviews: ImportReviewsDraft | undefined
  const revRaw = raw.reviews
  if (
    revRaw &&
    typeof revRaw === "object" &&
    !Array.isArray(revRaw)
  ) {
    const R = revRaw as Record<string, unknown>
    const bd = R.breakdown
    let breakdown = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    }
    if (bd && typeof bd === "object" && !Array.isArray(bd)) {
      const b = bd as Record<string, unknown>
      breakdown = {
        5: Math.round(Number(b[5]) || 0),
        4: Math.round(Number(b[4]) || 0),
        3: Math.round(Number(b[3]) || 0),
        2: Math.round(Number(b[2]) || 0),
        1: Math.round(Number(b[1]) || 0),
      }
    }
    const itemsRaw = R.items
    const items: ImportReviewItemDraft[] = []
    if (Array.isArray(itemsRaw)) {
      for (const it of itemsRaw.slice(0, 25)) {
        if (!it || typeof it !== "object" || Array.isArray(it)) continue
        const q = it as Record<string, unknown>
        const imgsR = q.images
        const imOut: string[] = []
        if (Array.isArray(imgsR))
          for (const u of imgsR)
            if (typeof u === "string" && u.trim()) imOut.push(u.trim().slice(0, 2000))
        items.push({
          rating: Math.min(5, Math.max(1, Math.round(num(q.rating, 5)))),
          author:
            typeof q.author === "string" ? q.author.trim().slice(0, 120) : "Anonymous",
          country:
            typeof q.country === "string" ? q.country.trim().slice(0, 80) : "",
          date: typeof q.date === "string" ? q.date.trim().slice(0, 80) : "",
          text: typeof q.text === "string" ? q.text.trim().slice(0, 4000) : "",
          images: imOut.slice(0, 8),
          variant:
            typeof q.variant === "string" ? q.variant.trim().slice(0, 200) : "",
          helpful_count: Math.max(0, Math.round(num(q.helpful_count, 0))),
          verified: Boolean(q.verified),
        })
      }
    }
    reviews = {
      total: Math.max(0, Math.round(num(R.total, 0))),
      average_rating: num(R.average_rating, 0),
      breakdown,
      items,
    }
  }

  const basePrice =
    num(raw.basePrice, 0) > 0
      ? parseFloat(num(raw.basePrice, 0).toFixed(4))
      : parseFloat(suggestedPrice.toFixed(4))

  return {
    title: title.trim().slice(0, 500),
    price: parseFloat(priceBase.toFixed(4)),
    original_price: parseFloat(Math.max(priceBase, num(raw.original_price, priceBase)).toFixed(4)),
    suggested_price: parseFloat(suggestedPrice.toFixed(4)),
    suggested_commission,
    profit_per_sale,
    basePrice,
    currency:
      typeof raw.currency === "string" ? raw.currency.slice(0, 12) : "EUR",
    images: imgs.slice(0, 20),
    image,
    description: desc.slice(0, 5500),
    variants,
    variants_count,
    colors,
    sizes,
    sizes_objects,
    shipping,
    specs,
    reviews,
    tags,
    stock: Math.max(0, Math.round(num(raw.stock, 99))),
    sku: typeof raw.sku === "string" ? raw.sku.slice(0, 120) : "",
    source_url: typeof raw.source_url === "string" ? raw.source_url.trim() : "",
    category:
      typeof raw.category === "string" ? raw.category.trim().slice(0, 200) : "",
    selected: raw.selected !== false,
  }
}

export function SupplierProductImport() {
  const router = useRouter()
  const [importMethod, setImportMethod] = useState<ImportMethod>("csv")
  const [isImporting, setIsImporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importedProducts, setImportedProducts] = useState<ImportPreviewRow[]>([])
  const [productUrl, setProductUrl] = useState("")
  const [aliExpressUrl, setAliExpressUrl] = useState("")

  const updateImportedProduct = useCallback(
    (index: number, field: keyof ImportPreviewRow, value: unknown) => {
      setImportedProducts((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row
          const next = { ...row, [field]: value } as ImportPreviewRow
          if (field === "variants" && Array.isArray(value)) {
            next.variants_count =
              value.length > 0 ? value.length : next.variants_count
          }
          return next
        })
      )
    },
    []
  )

  const handleCSVUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/supplier/import-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const data = (await res.json()) as { products?: unknown[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      const rows = Array.isArray(data.products) ? data.products : []
      setImportedProducts(
        rows.map((r) =>
          normalizeImportPreviewRow(typeof r === "object" && r ? (r as Record<string, unknown>) : {})
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
      setImportedProducts([])
    } finally {
      setIsImporting(false)
      e.target.value = ""
    }
  }, [])

  const handleURLImport = useCallback(async (url: string) => {
    const u = url.trim()
    if (!u) {
      setError("Enter a product URL")
      return
    }
    setIsImporting(true)
    setError(null)
    try {
      const res = await fetch("/api/supplier/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: u }),
      })
      const data = (await res.json()) as { products?: unknown[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      const rows = Array.isArray(data.products) ? data.products : []
      setImportedProducts(
        rows.map((r) =>
          normalizeImportPreviewRow(typeof r === "object" && r ? (r as Record<string, unknown>) : {})
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
      setImportedProducts([])
    } finally {
      setIsImporting(false)
    }
  }, [])

  const handleSelectAll = useCallback(() => {
    setImportedProducts((prev) => prev.map((p) => ({ ...p, selected: true })))
  }, [])

  const handleSaveImported = useCallback(async () => {
    const picked = importedProducts.filter((r) => r.selected !== false)
    if (picked.length === 0) {
      setError("Select at least one product to save.")
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/supplier/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ products: picked }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? "Save failed")
      router.push("/dashboard/supplier")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setIsSaving(false)
    }
  }, [importedProducts, router])

  const tabs: { id: ImportMethod; label: string }[] = [
    { id: "csv", label: "CSV Upload" },
    { id: "url", label: "Product URL" },
    { id: "shopify", label: "Shopify" },
    { id: "aliexpress", label: "AliExpress" },
  ]

  const selectedCount = importedProducts.filter((r) => r.selected !== false).length

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Import Products
          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-200">
            AI Powered
          </span>
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Import from CSV, Shopify, AliExpress, or any URL — review and publish to your catalog
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
        {tabs.map((method) => {
          const Icon = TAB_ICONS[method.id]
          const active = importMethod === method.id
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => setImportMethod(method.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                active
                  ? "border-black text-black dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {method.label}
            </button>
          )
        })}
      </div>

      {importMethod === "csv" ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-600 dark:bg-zinc-950">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/60">
            <svg className="h-8 w-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Upload CSV File</h3>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            AI will auto-map your columns. Supports any format.
          </p>
          <label className="inline-block cursor-pointer rounded-lg bg-black px-6 py-3 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
            {isImporting ? "Processing…" : "Choose File"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel"
              className="hidden"
              disabled={isImporting}
              onChange={handleCSVUpload}
            />
          </label>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Supports: Shopify, WooCommerce, Amazon, Custom CSV
          </p>
        </div>
      ) : null}

      {importMethod === "url" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-950">
          <h3 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Import from Product URL</h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              placeholder="https://example.com/product/12345"
              className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-900"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleURLImport(productUrl)}
            />
            <button
              type="button"
              disabled={isImporting}
              onClick={() => void handleURLImport(productUrl)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-white hover:bg-purple-700 disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Extract
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Scrapes structured data plus storefront-specific fallbacks — edit pricing before publishing
          </p>
        </div>
      ) : null}

      {importMethod === "shopify" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-950">
          <h3 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Connect Shopify Store</h3>
          <input
            type="text"
            placeholder="yourstore.myshopify.com"
            className="mb-3 w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-900"
          />
          <button
            type="button"
            className="w-full rounded-lg bg-[#96bf48] px-6 py-3 font-medium text-white hover:bg-[#7da83a]"
          >
            Connect &amp; Sync Products
          </button>
          <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
            <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">Auto-sync enabled (coming soon)</p>
            <p className="text-zinc-600 dark:text-zinc-400">
              Products will update when you change them in Shopify.
            </p>
          </div>
        </div>
      ) : null}

      {importMethod === "aliexpress" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-950">
          <h3 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Import from AliExpress</h3>
          <input
            type="url"
            placeholder="https://www.aliexpress.com/item/..."
            className="mb-3 w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-900"
            value={aliExpressUrl}
            onChange={(e) => setAliExpressUrl(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={isImporting || !aliExpressUrl.trim()}
              onClick={() => void handleURLImport(aliExpressUrl)}
              className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm text-white hover:bg-orange-700 disabled:opacity-60"
            >
              Import Product
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              + AI Rewrite Description
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              + Markup Calculator
            </button>
          </div>
        </div>
      ) : null}

      {importedProducts.length > 0 ? (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Preview ({importedProducts.length})
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={importedProducts.length === 0}
                onClick={handleSelectAll}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Select all
              </button>
              <button
                type="button"
                disabled={isSaving || selectedCount === 0}
                onClick={() => void handleSaveImported()}
                className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {isSaving ? "Saving…" : `Save ${selectedCount} to catalog`}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {importedProducts.map((p, i) => {
              const variantLabel =
                p.variants.length > 0 ? p.variants.length : p.variants_count
              const profit = p.suggested_price - p.price
              const thumb = (p.images[0] || p.image || "").trim()
              const profitPretty = Number.isFinite(profit)
                ? profit.toFixed(2)
                : "0.00"
              return (
                <div
                  key={`${p.sku || "sku"}-${i}`}
                  className="rounded-xl border-2 border-purple-200 bg-white p-4 dark:border-purple-900/60 dark:bg-zinc-950"
                >
                  <div className="flex gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb || "/placeholder.png"}
                      className="h-24 w-24 shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                      alt=""
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={p.title}
                        onChange={(e) =>
                          updateImportedProduct(i, "title", e.target.value)
                        }
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Ship:&nbsp;</span>
                        {(p.shipping?.from_country || "—") +
                          ` · ${p.shipping?.delivery_time ?? ""}` +
                          ` · processing ${p.shipping?.processing_time ?? ""}`}
                        {(p.shipping?.shipping_cost ?? 0) > 0 ? (
                          <span className="ml-1 font-medium">
                            · freight {p.currency === "EUR" ? "€" : ""}
                            {typeof p.shipping?.shipping_cost === "number"
                              ? p.shipping.shipping_cost.toFixed(2)
                              : "0"}
                            {p.currency !== "EUR" ? ` ${p.currency}` : ""}
                          </span>
                        ) : (
                          ""
                        )}
                        {(p.shipping.carrier ?? "").trim() ? (
                          <>
                            {" · carrier "}
                            {(p.shipping.carrier ?? "").slice(0, 48)}
                          </>
                        ) : (
                          ""
                        )}
                        {(p.reviews?.total ?? 0) > 0 ? (
                          <>
                            {" · ★"}
                            {(p.reviews!.average_rating ?? 0).toFixed(1)} (
                            {p.reviews!.total})
                          </>
                        ) : (
                          ""
                        )}
                        {" · "}
                        {p.colors.length} colors, {p.sizes.length} sizes,{" "}
                        {Object.keys(p.specs).length} spec lines · {p.images.length} images staged
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                          <label className="text-xs text-zinc-500 dark:text-zinc-400">Cost price</label>
                          <input
                            type="number"
                            step="any"
                            value={Number.isFinite(p.price) ? p.price : ""}
                            onChange={(e) =>
                              updateImportedProduct(
                                i,
                                "price",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 dark:text-zinc-400">
                            Selling price ({p.currency})
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={Number.isFinite(p.suggested_price) ? p.suggested_price : ""}
                            onChange={(e) =>
                              updateImportedProduct(
                                i,
                                "suggested_price",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm font-semibold dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 dark:text-zinc-400">Commission %</label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            step={1}
                            value={Number.isFinite(p.suggested_commission) ? p.suggested_commission : ""}
                            onChange={(e) =>
                              updateImportedProduct(
                                i,
                                "suggested_commission",
                                Math.min(
                                  50,
                                  Math.max(
                                    1,
                                    parseInt(e.target.value, 10) ||
                                      DEFAULT_IMPORT_COMMISSION
                                  )
                                )
                              )
                            }
                            className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                      <details className="text-sm text-zinc-600 dark:text-zinc-400">
                        <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
                          Description &amp; sourcing
                        </summary>
                        <div className="mt-2">
                          <label className="text-xs text-zinc-500 dark:text-zinc-400">Stock</label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={Number.isFinite(p.stock) ? p.stock : 0}
                            onChange={(e) =>
                              updateImportedProduct(
                                i,
                                "stock",
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="mt-0.5 w-full max-w-[10rem] rounded-lg border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <textarea
                          value={p.description}
                          rows={4}
                          onChange={(e) =>
                            updateImportedProduct(i, "description", e.target.value)
                          }
                          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="text"
                          value={p.source_url}
                          onChange={(e) =>
                            updateImportedProduct(i, "source_url", e.target.value)
                          }
                          placeholder="Source URL"
                          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="text"
                          value={p.category}
                          onChange={(e) =>
                            updateImportedProduct(i, "category", e.target.value)
                          }
                          placeholder="Category (catalog allowlist matched on save)"
                          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="text"
                          value={p.sku}
                          onChange={(e) =>
                            updateImportedProduct(i, "sku", e.target.value)
                          }
                          placeholder="SKU"
                          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </details>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md bg-green-100 px-2 py-1 text-green-700 dark:bg-green-950 dark:text-green-300">
                          {variantLabel} variants
                        </span>
                        <span className="rounded-md bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {p.stock} stock
                        </span>
                        <span className="rounded-md bg-purple-100 px-2 py-1 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          Profit:&nbsp;
                          {p.currency === "EUR"
                            ? `€${profitPretty}`
                            : `${profitPretty} ${p.currency}`}
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={p.selected !== false}
                      onChange={(e) =>
                        updateImportedProduct(i, "selected", e.target.checked)
                      }
                      className="mt-1 h-5 w-5 shrink-0 accent-purple-600"
                      aria-label={`Select ${p.title}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
