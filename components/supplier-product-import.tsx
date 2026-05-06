"use client"

import { Box, CloudUpload, Link2, ShoppingBag } from "lucide-react"
import type { ChangeEvent } from "react"
import { useCallback, useState } from "react"

export type ImportedProductPreview = {
  title: string
  price: string
  image: string
  description?: string
  variants: number
  stock: number
  sku: string
}

type ImportMethod = "csv" | "url" | "shopify" | "aliexpress"

const TAB_ICONS: Record<ImportMethod, typeof CloudUpload> = {
  csv: CloudUpload,
  url: Link2,
  shopify: ShoppingBag,
  aliexpress: Box,
}

export function SupplierProductImport() {
  const [importMethod, setImportMethod] = useState<ImportMethod>("csv")
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importedProducts, setImportedProducts] = useState<ImportedProductPreview[]>([])
  const [productUrl, setProductUrl] = useState("")
  const [aliExpressUrl, setAliExpressUrl] = useState("")

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
      const data = (await res.json()) as { products?: ImportedProductPreview[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      setImportedProducts(Array.isArray(data.products) ? data.products : [])
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
      const data = (await res.json()) as { products?: ImportedProductPreview[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      setImportedProducts(Array.isArray(data.products) ? data.products : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
      setImportedProducts([])
    } finally {
      setIsImporting(false)
    }
  }, [])

  const tabs: { id: ImportMethod; label: string }[] = [
    { id: "csv", label: "CSV Upload" },
    { id: "url", label: "Product URL" },
    { id: "shopify", label: "Shopify" },
    { id: "aliexpress", label: "AliExpress" },
  ]

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
          Import from CSV, Shopify, AliExpress, or any URL in seconds
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
            AI extracts: title, price, images, description, variants, stock
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
              Imported Products ({importedProducts.length})
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Select All
              </button>
              <button
                type="button"
                className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Import {importedProducts.length} Products
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {importedProducts.map((p, i) => (
              <div
                key={`${p.sku}-${i}`}
                className="rounded-xl border border-zinc-200 bg-white p-4 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image || "/placeholder.png"}
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.title}</p>
                    <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">€{p.price}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                        {p.variants} variants
                      </span>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {p.stock} stock
                      </span>
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="mt-1 h-5 w-5 shrink-0" aria-label={`Select ${p.title}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
