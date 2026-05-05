"use client"

import { useMemo, useState } from "react"

import { CATEGORIES, COLORS, isMulticolorSwatch } from "@/lib/product-catalog-constants"
import { catalogHexForColorName, type ProductColorImageRow } from "@/lib/product-color-images"
import { ProductVariantsAdvanced } from "@/components/product-variants-advanced"
import type { ProductVariantsJson } from "@/lib/product-variants"

export type ProductAttributesFieldsProps = {
  categories: string[]
  onCategoriesChange: (next: string[]) => void
  colors: string[]
  onColorsChange: (next: string[]) => void
  colorImages: ProductColorImageRow[]
  onColorImagesChange: (next: ProductColorImageRow[]) => void
  tags: string[]
  onTagsChange: (next: string[]) => void
  variants: ProductVariantsJson | null
  onVariantsChange: (next: ProductVariantsJson | null) => void
  /** Pass-through for advanced variants / AI (product form) */
  productTitle?: string
  basePriceEUR?: string
  defaultCommission?: string
}

export function ProductAttributesFields({
  categories,
  onCategoriesChange,
  colors,
  onColorsChange,
  colorImages,
  onColorImagesChange,
  tags,
  onTagsChange,
  variants,
  onVariantsChange,
  productTitle = "",
  basePriceEUR = "",
  defaultCommission = "20",
}: ProductAttributesFieldsProps) {
  const [catQuery, setCatQuery] = useState("")
  const [tagInput, setTagInput] = useState("")

  const filteredCategories = useMemo(
    () => CATEGORIES.filter((c) => c.toLowerCase().includes(catQuery.trim().toLowerCase())),
    [catQuery]
  )

  function toggleCategory(c: string) {
    if (categories.includes(c)) {
      onCategoriesChange(categories.filter((x) => x !== c))
      return
    }
    if (categories.length >= 3) return
    onCategoriesChange([...categories, c])
  }

  function toggleColorName(name: string) {
    if (colors.includes(name)) {
      onColorsChange(colors.filter((x) => x !== name))
      return
    }
    onColorsChange([...colors, name])
  }

  function rowForColor(colorName: string): ProductColorImageRow {
    return (
      colorImages.find((r) => r.color === colorName) ?? {
        color: colorName,
        hex: catalogHexForColorName(colorName),
        image: "",
      }
    )
  }

  function patchColorRow(colorName: string, patch: Partial<ProductColorImageRow>) {
    onColorImagesChange(
      colors.map((c) => {
        const base = rowForColor(c)
        return c === colorName ? { ...base, ...patch } : base
      })
    )
  }

  function commitTag() {
    const t = tagInput.trim()
    if (!t) return
    if (tags.includes(t)) {
      setTagInput("")
      return
    }
    onTagsChange([...tags, t].slice(0, 40))
    setTagInput("")
  }

  return (
    <div className="md:col-span-2 space-y-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
      {/* Categories */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Categories (max 3)</label>
        <input
          type="search"
          value={catQuery}
          onChange={(e) => setCatQuery(e.target.value)}
          placeholder="Search categories..."
          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Selected: {categories.length}/3{categories.length ? ` — ${categories.join(" · ")}` : ""}
        </p>
        <div className="mt-3 grid max-h-52 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-3">
          {filteredCategories.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
            >
              <input
                type="checkbox"
                checked={categories.includes(c)}
                disabled={!categories.includes(c) && categories.length >= 3}
                onChange={() => toggleCategory(c)}
                className="mt-0.5"
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Available Colors</label>
        <div className="mt-3 flex flex-wrap gap-3">
          {COLORS.map((c) => {
            const sel = colors.includes(c.name)
            const mc = isMulticolorSwatch(c)
            const isLight = !mc && (c.hex === "#FFFFFF" || c.hex === "#F5E6D3" || c.hex === "#FFD700")
            return (
              <label
                key={c.name}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs ${
                  sel ? "border-blue-500 ring-2 ring-blue-400" : "border-zinc-200 dark:border-zinc-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sel}
                  onChange={() => toggleColorName(c.name)}
                  className="sr-only"
                />
                <span
                  className={`h-10 w-10 rounded-full shadow-inner ring-1 ring-black/15 ${
                    mc ? "bg-[conic-gradient(at_50%_50%,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]" : ""
                  }`}
                  style={mc ? undefined : { backgroundColor: c.hex }}
                  title={c.name}
                />
                <span className={`max-w-[4.5rem] text-center ${isLight ? "text-zinc-800 dark:text-zinc-200" : ""}`}>
                  {c.name}
                </span>
              </label>
            )
          })}
        </div>

        {colors.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Optional: Add image per color</p>
            <div className="mt-3 space-y-3">
              {colors.map((colorName) => {
                const row = rowForColor(colorName)
                const meta = COLORS.find((c) => c.name === colorName)
                const mc = meta ? isMulticolorSwatch(meta) : row.hex === "multicolor"
                const uploadId = `color-upload-${colorName.replace(/\s+/g, "-")}`
                const img = row.image.trim()
                return (
                  <div
                    key={colorName}
                    className="mt-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span
                        className={`h-6 w-6 shrink-0 rounded-full ring-1 ring-black/15 ${
                          mc
                            ? "bg-[conic-gradient(at_50%_50%,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]"
                            : ""
                        }`}
                        style={mc ? undefined : { backgroundColor: row.hex }}
                      />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{colorName}</span>
                    </div>

                    <label className="text-sm text-zinc-700 dark:text-zinc-300">Image for {colorName}</label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        type="url"
                        value={row.image}
                        onChange={(e) => patchColorRow(colorName, { image: e.target.value })}
                        placeholder={`https://... image URL for ${colorName}`}
                        className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      />
                      <span className="text-sm text-zinc-400">or</span>
                      <label
                        htmlFor={uploadId}
                        className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        Upload
                        <input
                          id={uploadId}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            e.target.value = ""
                            if (!f) return
                            const prev = row.image
                            if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
                            patchColorRow(colorName, { image: URL.createObjectURL(f) })
                          }}
                        />
                      </label>
                    </div>

                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt=""
                        className="mt-2 h-20 w-20 rounded border border-zinc-200 object-contain dark:border-zinc-600"
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <ProductVariantsAdvanced
        variants={variants}
        onVariantsChange={onVariantsChange}
        productTitle={productTitle}
        basePriceEUR={basePriceEUR}
        defaultCommission={defaultCommission}
        categories={categories}
        colors={colors}
        tags={tags}
      />

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Tags</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-1 text-xs dark:bg-zinc-700"
            >
              {t}
              <button
                type="button"
                className="text-zinc-600 hover:text-red-600 dark:text-zinc-300"
                onClick={() => onTagsChange(tags.filter((x) => x !== t))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitTag())}
            placeholder="Add a tag (Enter)"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={commitTag}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
