"use client"

import { useMemo, useState } from "react"

import { CATEGORIES } from "@/lib/product-catalog-constants"
import { ProductVariantsAdvanced } from "@/components/product-variants-advanced"
import type { ProductVariantsJson } from "@/lib/product-variants"

export type ProductAttributesFieldsProps = {
  categories: string[]
  onCategoriesChange: (next: string[]) => void
  colors: string[]
  tags: string[]
  onTagsChange: (next: string[]) => void
  variants: ProductVariantsJson | null
  onVariantsChange: (next: ProductVariantsJson | null) => void
  /** Pass-through for advanced variants / AI (product form) */
  productTitle?: string
  basePriceEUR?: string
  defaultCommission?: string
  /** Primary product image URL for color preview */
  mainImage?: string
}

export function ProductAttributesFields({
  categories,
  onCategoriesChange,
  colors,
  tags,
  onTagsChange,
  variants,
  onVariantsChange,
  productTitle = "",
  basePriceEUR = "",
  defaultCommission = "20",
  mainImage = "",
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

      <ProductVariantsAdvanced
        variants={variants}
        onVariantsChange={onVariantsChange}
        productTitle={productTitle}
        basePriceEUR={basePriceEUR}
        defaultCommission={defaultCommission}
        mainImage={mainImage}
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
