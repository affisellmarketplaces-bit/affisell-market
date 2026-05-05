"use client"

import { useCallback, useMemo, useState } from "react"

import {
  newVariantRowId,
  patchProductVariants,
  type ProductVariantLine,
  type ProductVariantsJson,
} from "@/lib/product-variants"

function slugPart(s: string) {
  return s
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .toUpperCase() || "SKU"
}

export type ProductVariantsAdvancedProps = {
  variants: ProductVariantsJson | null
  onVariantsChange: (next: ProductVariantsJson | null) => void
  productTitle: string
  basePriceEUR: string
  defaultCommission: string
  categories: string[]
  colors: string[]
  tags: string[]
}

export function ProductVariantsAdvanced({
  variants,
  onVariantsChange,
  productTitle,
  basePriceEUR,
  defaultCommission,
  categories,
  colors,
  tags,
}: ProductVariantsAdvancedProps) {
  const rows = variants?.variantRows ?? []
  const [showBulkCreator, setShowBulkCreator] = useState(false)
  const [bulkAttr1, setBulkAttr1] = useState("")
  const [bulkAttr2, setBulkAttr2] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  const baseCents = useMemo(() => {
    const n = Number.parseFloat(basePriceEUR)
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0
  }, [basePriceEUR])

  const defaultComm = useMemo(() => {
    const n = Number.parseFloat(defaultCommission)
    return Number.isFinite(n) ? Math.min(99, Math.max(0, Math.round(n))) : 20
  }, [defaultCommission])

  const setRows = useCallback(
    (next: ProductVariantLine[]) => {
      onVariantsChange(patchProductVariants(variants, { variantRows: next.length ? next : undefined }))
    },
    [onVariantsChange, variants]
  )

  const heuristicRows = useCallback((): ProductVariantLine[] => {
    const cols = colors.length ? colors : ["Default"]
    const sizes = ["S", "M", "L"]
    const out: ProductVariantLine[] = []
    for (const c of cols) {
      for (const s of sizes) {
        const name = cols.length === 1 && cols[0] === "Default" ? `Standard / ${s}` : `${c} / ${s}`
        out.push({
          id: newVariantRowId(),
          name,
          sku: `${slugPart(c)}-${s}`.toUpperCase(),
          priceCents: baseCents,
          stock: 0,
          commission: defaultComm,
          sales: 0,
        })
      }
    }
    return out
  }, [colors, baseCents, defaultComm])

  const generateAIVariants = useCallback(async () => {
    setAiBusy(true)
    setAiNote(null)
    try {
      const res = await fetch("/api/supplier/suggest-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productName: productTitle.trim(),
          categories,
          colors,
          tags,
          basePriceEur: Number.parseFloat(basePriceEUR) || 0,
          commission: Number.parseFloat(defaultCommission) || 20,
        }),
      })
      const data = (await res.json()) as { rows?: ProductVariantLine[]; error?: string }
      if (Array.isArray(data.rows) && data.rows.length > 0) {
        setRows(data.rows)
        setAiNote("Variants generated with AI.")
        return
      }
      setRows(heuristicRows())
      setAiNote(data.error ? `${data.error} — applied a quick template instead.` : "Applied a quick template.")
    } catch {
      setRows(heuristicRows())
      setAiNote("AI unavailable — applied a quick template instead.")
    } finally {
      setAiBusy(false)
    }
  }, [
    productTitle,
    categories,
    colors,
    tags,
    basePriceEUR,
    defaultCommission,
    heuristicRows,
    setRows,
  ])

  const addVariant = useCallback(() => {
    setRows([
      ...rows,
      {
        id: newVariantRowId(),
        name: "New variant",
        sku: "",
        priceCents: baseCents,
        stock: 0,
        commission: defaultComm,
        sales: 0,
      },
    ])
  }, [rows, setRows, baseCents, defaultComm])

  const updateVariant = useCallback(
    (id: string, field: keyof ProductVariantLine, value: string | number) => {
      setRows(
        rows.map((r) => {
          if (r.id !== id) return r
          if (field === "priceCents") return { ...r, priceCents: typeof value === "number" ? value : r.priceCents }
          if (field === "stock") return { ...r, stock: typeof value === "number" ? value : r.stock }
          if (field === "commission") return { ...r, commission: typeof value === "number" ? value : r.commission }
          if (field === "sales") return { ...r, sales: typeof value === "number" ? value : r.sales }
          if (field === "name") return { ...r, name: String(value).slice(0, 160) }
          if (field === "sku") return { ...r, sku: String(value).slice(0, 80) }
          return r
        })
      )
    },
    [rows, setRows]
  )

  const removeVariant = useCallback(
    (id: string) => {
      setRows(rows.filter((r) => r.id !== id))
    },
    [rows, setRows]
  )

  const generateSKU = useCallback(
    (id: string) => {
      const row = rows.find((r) => r.id === id)
      const prefix = slugPart(productTitle || row?.name || "VARIANT")
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
      updateVariant(id, "sku", `${prefix}-${suffix}`)
    },
    [rows, productTitle, updateVariant]
  )

  const createBulkVariants = useCallback(() => {
    const part1 = bulkAttr1
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const part2 = bulkAttr2
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const attr2 = part2.length ? part2 : [""]
    const attr1 = part1.length ? part1 : ["Standard"]
    const created: ProductVariantLine[] = []
    for (const a of attr1) {
      for (const b of attr2) {
        const name = b ? `${a} / ${b}` : a
        created.push({
          id: newVariantRowId(),
          name,
          sku: "",
          priceCents: baseCents,
          stock: 0,
          commission: defaultComm,
          sales: 0,
        })
      }
    }
    setRows([...rows, ...created])
    setBulkAttr1("")
    setBulkAttr2("")
    setShowBulkCreator(false)
  }, [bulkAttr1, bulkAttr2, rows, setRows, baseCents, defaultComm])

  const modelValue = variants?.model ?? ""

  return (
    <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Product Variants
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-200">
              AI Powered
            </span>
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Different versions with own price, stock, and commission
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={aiBusy}
            onClick={() => void generateAIVariants()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {aiBusy ? "Generating…" : "AI Generate"}
          </button>
          <button
            type="button"
            onClick={addVariant}
            className="rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Add Variant
          </button>
        </div>
      </div>

      {aiNote ? <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">{aiNote}</p> : null}

      {showBulkCreator ? (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">Bulk create variants</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Colors: Black, White, Red"
              value={bulkAttr1}
              onChange={(e) => setBulkAttr1(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <input
              type="text"
              placeholder="Sizes: S, M, L (optional)"
              value={bulkAttr2}
              onChange={(e) => setBulkAttr2(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={createBulkVariants}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Create All
            </button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <p className="mb-2 text-zinc-600 dark:text-zinc-400">No variants yet</p>
          <button
            type="button"
            onClick={() => setShowBulkCreator(!showBulkCreator)}
            className="text-sm text-purple-600 hover:underline dark:text-purple-400"
          >
            Or bulk create from attributes →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((variant) => (
            <div
              key={variant.id}
              className="group relative rounded-xl border border-zinc-200 bg-white p-4 transition hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {variant.sales > 0 ? (
                <div className="absolute -top-2 -right-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-medium text-white">
                  {variant.sales} sold
                </div>
              ) : null}

              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-12 sm:col-span-4 lg:col-span-3">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Variant</label>
                  <input
                    type="text"
                    placeholder="e.g. Matte Black XL"
                    value={variant.name}
                    onChange={(e) => updateVariant(variant.id, "name", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </div>

                <div className="col-span-12 sm:col-span-4 lg:col-span-3">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">SKU</label>
                  <div className="mt-1 flex gap-1">
                    <input
                      type="text"
                      value={variant.sku}
                      onChange={(e) => updateVariant(variant.id, "sku", e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      placeholder="Auto"
                    />
                    <button
                      type="button"
                      onClick={() => generateSKU(variant.id)}
                      className="shrink-0 rounded-lg border border-zinc-300 px-2 py-2 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
                      title="Generate SKU"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="col-span-6 sm:col-span-4 lg:col-span-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Price (€)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={variant.priceCents === 0 ? "" : (variant.priceCents / 100).toFixed(2)}
                    onChange={(e) => {
                      const v = Number.parseFloat(e.target.value)
                      updateVariant(
                        variant.id,
                        "priceCents",
                        Number.isFinite(v) ? Math.max(0, Math.round(v * 100)) : 0
                      )
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </div>

                <div className="col-span-3 sm:col-span-2 lg:col-span-1">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Stock</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={variant.stock}
                    onChange={(e) =>
                      updateVariant(variant.id, "stock", Math.max(0, Math.round(Number(e.target.value) || 0)))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </div>

                <div className="col-span-3 sm:col-span-2 lg:col-span-1">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Comm. %</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    step={1}
                    value={variant.commission}
                    onChange={(e) =>
                      updateVariant(
                        variant.id,
                        "commission",
                        Math.min(99, Math.max(0, Math.round(Number(e.target.value) || 0)))
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </div>

                <div className="col-span-12 flex justify-end lg:col-span-2">
                  <button
                    type="button"
                    onClick={() => removeVariant(variant.id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Model / Version</label>
        <input
          type="text"
          value={modelValue}
          onChange={(e) => {
            const t = e.target.value.trim()
            onVariantsChange(patchProductVariants(variants, { model: t ? t.slice(0, 240) : undefined }))
          }}
          placeholder="e.g. iPhone 15 Pro – 2025 edition"
          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
      </div>
    </div>
  )
}
