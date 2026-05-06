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

type ColorOption = {
  name: string
  hex: string
  custom?: boolean
}

const PRESET_COLORS: ColorOption[] = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Space Gray", hex: "#8E8E93" },
  { name: "Silver", hex: "#C7C7CC" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Blue", hex: "#007AFF" },
  { name: "Midnight", hex: "#1C1C1E" },
  { name: "Red", hex: "#FF3B30" },
  { name: "Green", hex: "#34C759" },
  { name: "Pink", hex: "#FF2D92" },
  { name: "Purple", hex: "#AF52DE" },
  { name: "Yellow", hex: "#FFCC02" },
  { name: "Orange", hex: "#FF9500" },
  { name: "Brown", hex: "#A2845E" },
  { name: "Beige", hex: "#F5E6D3" },
  { name: "Turquoise", hex: "#5AC8FA" },
]

const CUSTOMER_REQUESTS = [
  { name: "Rose Gold", hex: "#B76E79", count: 12 },
  { name: "Teal", hex: "#008080", count: 8 },
  { name: "Lavender", hex: "#E6E6FA", count: 5 },
] as const

export type ProductVariantsAdvancedProps = {
  variants: ProductVariantsJson | null
  onVariantsChange: (next: ProductVariantsJson | null) => void
  productTitle: string
  basePriceEUR: string
  defaultCommission: string
  mainImage: string
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
  mainImage,
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

  const [previewColor, setPreviewColor] = useState<string | null>(null)
  const [showCustomColor, setShowCustomColor] = useState(false)
  const [customColors, setCustomColors] = useState<ColorOption[]>([])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [customHex, setCustomHex] = useState("#ff6b6b")
  const [customName, setCustomName] = useState("")

  const allColors = useMemo(() => [...PRESET_COLORS, ...customColors], [customColors])

  const baseCents = useMemo(() => {
    const n = Number.parseFloat(basePriceEUR)
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0
  }, [basePriceEUR])

  const defaultComm = useMemo(() => {
    const n = Number.parseFloat(defaultCommission)
    return Number.isFinite(n) ? Math.min(50, Math.max(1, Math.round(n))) : 15
  }, [defaultCommission])

  const setRows = useCallback(
    (next: ProductVariantLine[]) => {
      onVariantsChange(patchProductVariants(variants, { variantRows: next.length ? next : undefined }))
    },
    [onVariantsChange, variants]
  )

  const getColorHex = useCallback(
    (name: string) => allColors.find((c) => c.name === name)?.hex ?? "#CCCCCC",
    [allColors]
  )

  const getVariantForColor = useCallback(
    (colorName: string) =>
      rows.find((v) => v.name.toLowerCase().includes(colorName.toLowerCase())),
    [rows]
  )

  const handleColorClick = useCallback((colorName: string) => {
    setPreviewColor(colorName)
    setSelectedColors((prev) => (prev.includes(colorName) ? prev : [...prev, colorName]))
  }, [])

  const addCustomColor = useCallback(() => {
    const hex = customHex || "#888888"
    const name = customName.trim() || `Custom ${customColors.length + 1}`
    if (customColors.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setShowCustomColor(false)
      return
    }
    const newColor: ColorOption = { name, hex, custom: true }
    setCustomColors((prev) => [...prev, newColor])
    setSelectedColors((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setShowCustomColor(false)
    setCustomName("")
    setCustomHex("#ff6b6b")
  }, [customColors.length, customHex, customName])

  const createVariantFromColor = useCallback(
    (colorName: string) => {
      if (getVariantForColor(colorName)) return
      const title = productTitle.trim() || "PRD"
      const sku = `${title.substring(0, 3).toUpperCase()}-${colorName.replace(/\s+/g, "").substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
      const line: ProductVariantLine = {
        id: newVariantRowId(),
        name: colorName,
        sku,
        priceCents: baseCents,
        stock: 10,
        commission: defaultComm,
        sales: 0,
        image: "",
        priceType: "fixed",
      }
      setRows([...rows, line])
    },
    [rows, setRows, productTitle, baseCents, defaultComm, getVariantForColor]
  )

  const scrollToVariantForColor = useCallback(
    (colorName: string) => {
      const v = getVariantForColor(colorName)
      if (!v) return
      const el = document.querySelector(`[data-variant-id="${v.id}"]`)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    },
    [getVariantForColor]
  )

  const previewImgSrc = (colorName: string | null) => {
    if (!colorName) return mainImage
    const v = getVariantForColor(colorName)
    const u = v?.image?.trim()
    return u || mainImage
  }

  const formatEur = (cents: number) =>
    cents <= 0 ? "—" : (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
      const data = (await res.json()) as {
        variants?: ProductVariantLine[]
        rows?: ProductVariantLine[]
        error?: string
      }
      const fromApi = Array.isArray(data.variants) ? data.variants : data.rows
      if (Array.isArray(fromApi) && fromApi.length > 0) {
        setRows(fromApi)
        setAiNote("Variants suggested.")
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
          if (field === "commission")
            return {
              ...r,
              commission:
                typeof value === "number"
                  ? Math.min(50, Math.max(1, Math.round(value)))
                  : r.commission,
            }
          if (field === "sales") return { ...r, sales: typeof value === "number" ? value : r.sales }
          if (field === "name") return { ...r, name: String(value).slice(0, 160) }
          if (field === "sku") return { ...r, sku: String(value).slice(0, 80) }
          if (field === "image") return { ...r, image: String(value).slice(0, 2000) }
          if (field === "priceType") return { ...r, priceType: String(value).slice(0, 32) }
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
      {/* —— Advanced Color System —— */}
      <div className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Available Colors</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Click a color to preview its variant</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomColor(!showCustomColor)}
            className="rounded-lg border border-purple-200 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/50"
          >
            + Custom Color
          </button>
        </div>

        {previewColor ? (
          <div className="mb-4 rounded-xl bg-zinc-900 p-4 text-white">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative shrink-0">
                <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-white">
                  {previewImgSrc(previewColor) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob / external URLs
                    <img
                      src={previewImgSrc(previewColor)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No image</div>
                  )}
                </div>
                <div
                  className="absolute -right-1 -bottom-1 h-6 w-6 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: getColorHex(previewColor) }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {productTitle || "Product"} — {previewColor}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-xl font-semibold">
                    €
                    {formatEur(getVariantForColor(previewColor)?.priceCents ?? baseCents)}
                  </span>
                  <span className="rounded bg-white/20 px-2 py-0.5 text-xs">
                    {getVariantForColor(previewColor)
                      ? `${getVariantForColor(previewColor)?.stock ?? 0} in stock`
                      : "No variant"}
                  </span>
                  {getVariantForColor(previewColor)?.sales ? (
                    <span className="rounded bg-green-500 px-2 py-0.5 text-xs">
                      {getVariantForColor(previewColor)?.sales} sold
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  {getVariantForColor(previewColor) ? (
                    <button
                      type="button"
                      onClick={() => scrollToVariantForColor(previewColor)}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200"
                    >
                      Edit Variant
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => createVariantFromColor(previewColor)}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                    >
                      Create Variant
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showCustomColor ? (
          <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/30">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Color</label>
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-300 dark:border-zinc-600"
                />
              </div>
              <div className="min-w-[12rem] flex-1">
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Sunset Orange"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
              </div>
              <button
                type="button"
                onClick={addCustomColor}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
              >
                Add
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-8 md:grid-cols-12">
          {allColors.map((color) => {
            const variant = getVariantForColor(color.name)
            const isSelected = selectedColors.includes(color.name)
            const isPreview = previewColor === color.name
            const lightSwatch =
              color.hex.toUpperCase() === "#FFFFFF" || color.hex.toUpperCase() === "#F5E6D3"

            return (
              <button
                key={`${color.name}-${color.hex}`}
                type="button"
                onClick={() => handleColorClick(color.name)}
                className={`group relative flex flex-col items-center rounded-xl border-2 p-2.5 transition-all ${
                  isPreview
                    ? "z-10 scale-105 border-black bg-black text-white shadow-xl dark:border-white dark:bg-zinc-800"
                    : isSelected
                      ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                      : "border-zinc-200 hover:-translate-y-0.5 hover:border-zinc-400 dark:border-zinc-700"
                }`}
              >
                <div className="relative">
                  <div
                    className={`h-11 w-11 rounded-full border-2 border-white shadow-md ring-1 ring-zinc-200 dark:ring-zinc-600 ${
                      lightSwatch ? "ring-2 ring-zinc-300" : ""
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                  {variant ? (
                    <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 shadow-lg">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : null}
                  {color.custom ? (
                    <div className="absolute -bottom-1 -left-1 rounded px-1 py-0.5 text-[10px] font-bold text-white bg-purple-600">
                      C
                    </div>
                  ) : null}
                </div>
                <span
                  className={`mt-1.5 text-center text-[11px] font-medium leading-tight ${
                    isPreview ? "text-white" : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {color.name}
                </span>
                {variant ? (
                  <span className={`text-[10px] ${isPreview ? "text-zinc-300" : "text-zinc-500"}`}>
                    €{formatEur(variant.priceCents)}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-100">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0.538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                Customer Color Requests
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">Add these to boost sales</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_REQUESTS.map((req) => (
              <button
                key={req.name}
                type="button"
                onClick={() => {
                  if (customColors.some((c) => c.name === req.name) || PRESET_COLORS.some((c) => c.name === req.name)) {
                    handleColorClick(req.name)
                    return
                  }
                  setCustomColors((prev) => [...prev, { name: req.name, hex: req.hex, custom: true }])
                  setSelectedColors((prev) => (prev.includes(req.name) ? prev : [...prev, req.name]))
                  handleColorClick(req.name)
                }}
                className="group flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-700 dark:bg-zinc-900 dark:hover:bg-amber-950/50"
              >
                <div
                  className="h-3.5 w-3.5 rounded-full border border-zinc-300"
                  style={{ backgroundColor: req.hex }}
                />
                <span className="font-medium">+ {req.name}</span>
                <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                  {req.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Black: 47% of sales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Blue trending +23%
            </span>
          </div>
          <span className="text-zinc-400">{selectedColors.length} colors selected</span>
        </div>
      </div>

      {/* —— Product variants (matrix) —— */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Product Variants
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-200">
              AI Powered
            </span>
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Different versions with price, stock, and offered affiliate commission
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
              data-variant-id={variant.id}
              className="group relative rounded-xl border border-zinc-200 bg-white p-4 transition hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {variant.sales > 0 ? (
                <div className="absolute -top-2 -right-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-medium text-white">
                  {variant.sales} sold
                </div>
              ) : null}

              <div className="grid grid-cols-12 items-end gap-3">
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

                <div className="col-span-12 md:col-span-6 lg:col-span-4">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Variant image URL</label>
                  <input
                    type="url"
                    value={variant.image ?? ""}
                    onChange={(e) => updateVariant(variant.id, "image", e.target.value)}
                    placeholder="https://… optional colorway image"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
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

                <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                  <label className="flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Offered Commission
                    <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                      For Affiliates
                    </span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={variant.commission || 15}
                    placeholder="15"
                    onChange={(e) =>
                      updateVariant(
                        variant.id,
                        "commission",
                        Math.min(50, Math.max(1, Math.round(Number(e.target.value) || 15)))
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Affiliates earn this % per sale
                  </p>
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

      {rows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 dark:border-green-900 dark:from-green-950/40 dark:to-emerald-950/40">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-900 dark:text-green-100">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Affiliate Earnings Preview
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {rows.slice(0, 3).map((v) => {
              const priceEur = v.priceCents > 0 ? v.priceCents / 100 : baseCents / 100
              const comm = typeof v.commission === "number" ? v.commission : 15
              const earning = ((priceEur * comm) / 100).toFixed(2)
              return (
                <div
                  key={v.id}
                  className="rounded-lg border border-green-100 bg-white p-2.5 dark:border-green-900 dark:bg-zinc-950"
                >
                  <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{v.name}</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">€{earning}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    per sale ({comm}%)
                  </p>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-green-700 dark:text-green-300">
            Tip: Higher commission attracts more affiliates to promote your listings.
          </p>
        </div>
      ) : null}

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
