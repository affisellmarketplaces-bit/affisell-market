"use client"

import { useMemo, useState } from "react"

import {
  CATEGORIES,
  COLORS,
  VARIANT_GROUP_LABELS,
  VARIANT_PRESETS,
  type VariantGroupKey,
} from "@/lib/product-catalog-constants"
import type { ProductVariantsJson } from "@/lib/product-variants"

export type ProductAttributesFieldsProps = {
  categories: string[]
  onCategoriesChange: (next: string[]) => void
  colors: string[]
  onColorsChange: (next: string[]) => void
  tags: string[]
  onTagsChange: (next: string[]) => void
  variants: ProductVariantsJson | null
  onVariantsChange: (next: ProductVariantsJson | null) => void
}

const VARIANT_KEYS: VariantGroupKey[] = ["size", "storage", "ram", "material"]

function toggleInList(list: string[], value: string): string[] {
  const i = list.indexOf(value)
  if (i >= 0) {
    return list.filter((_, j) => j !== i)
  }
  return [...list, value]
}

function mergeVariants(
  prev: ProductVariantsJson | null,
  patch: Partial<{ [K in keyof ProductVariantsJson]: ProductVariantsJson[K] | undefined }>
): ProductVariantsJson | null {
  const base: ProductVariantsJson = { ...(prev ?? {}) }
  for (const [k, val] of Object.entries(patch) as [keyof ProductVariantsJson, unknown][]) {
    if (val === undefined) {
      delete (base as Record<string, unknown>)[k as string]
      continue
    }
    if (
      (k === "size" || k === "storage" || k === "ram" || k === "material") &&
      Array.isArray(val)
    ) {
      ;(base as Record<string, unknown>)[k] = val
      continue
    }
    if (k === "model") {
      if (typeof val === "string") {
        const t = val.trim()
        if (!t) delete base.model
        else base.model = t
      }
      continue
    }
    if (k === "imageByColor" && val && typeof val === "object") {
      const keys = Object.keys(val as object)
      if (!keys.length) delete base.imageByColor
      else base.imageByColor = val as Record<string, string>
    }
  }
  return Object.keys(base).length ? base : null
}

export function ProductAttributesFields({
  categories,
  onCategoriesChange,
  colors,
  onColorsChange,
  tags,
  onTagsChange,
  variants,
  onVariantsChange,
}: ProductAttributesFieldsProps) {
  const v = variants ?? {}
  const [catQuery, setCatQuery] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [customByGroup, setCustomByGroup] = useState<Partial<Record<VariantGroupKey, string>>>({})

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
      const ibc = v.imageByColor
      if (ibc && ibc[name]) {
        const next = { ...ibc }
        delete next[name]
        onVariantsChange(mergeVariants(variants, { imageByColor: Object.keys(next).length ? next : undefined }))
      }
      return
    }
    onColorsChange([...colors, name])
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

  function addVariantGroup(key: VariantGroupKey) {
    if (Array.isArray(v[key])) return
    onVariantsChange(mergeVariants(variants, { [key]: [] }))
  }

  function removeVariantGroup(key: VariantGroupKey) {
    onVariantsChange(mergeVariants(variants, { [key]: undefined }))
  }

  function togglePreset(key: VariantGroupKey, value: string) {
    const cur = v[key] ?? []
    const nextList = toggleInList([...cur], value)
    onVariantsChange(mergeVariants(variants, { [key]: nextList }))
  }

  function addCustomVariant(key: VariantGroupKey) {
    const raw = (customByGroup[key] ?? "").trim()
    if (!raw) return
    const cur = v[key] ?? []
    if (cur.includes(raw)) return
    onVariantsChange(mergeVariants(variants, { [key]: [...cur, raw] }))
    setCustomByGroup((prev) => ({ ...prev, [key]: "" }))
  }

  const activeVariantKeys = VARIANT_KEYS.filter((k) => Array.isArray(v[k]))

  return (
    <div className="md:col-span-2 space-y-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
      {/* Categories */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Catégories (max 3)</label>
        <input
          type="search"
          value={catQuery}
          onChange={(e) => setCatQuery(e.target.value)}
          placeholder="Rechercher une catégorie…"
          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Sélection : {categories.length}/3{categories.length ? ` — ${categories.join(" · ")}` : ""}
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
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Couleurs disponibles</label>
        <div className="mt-3 flex flex-wrap gap-3">
          {COLORS.map((c) => {
            const sel = colors.includes(c.name)
            const isLight = !c.multicolor && (c.hex === "#FFFFFF" || c.hex === "#F5E6D3" || c.hex === "#FFD700")
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
                    c.multicolor
                      ? "bg-[conic-gradient(at_50%_50%,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]"
                      : ""
                  }`}
                  style={c.multicolor ? undefined : { backgroundColor: c.hex }}
                  title={c.name}
                />
                <span className={`max-w-[4.5rem] text-center ${isLight ? "text-zinc-800 dark:text-zinc-200" : ""}`}>
                  {c.name}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Variants */}
      <div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Variantes</label>
            <select
              defaultValue=""
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              onChange={(e) => {
                const key = e.target.value as VariantGroupKey
                e.target.value = ""
                if (VARIANT_KEYS.includes(key) && !activeVariantKeys.includes(key)) {
                  addVariantGroup(key)
                }
              }}
            >
              <option value="">+ Ajouter un type de variante…</option>
              {VARIANT_KEYS.filter((k) => !activeVariantKeys.includes(k)).map((k) => (
                <option key={k} value={k}>
                  {VARIANT_GROUP_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-5">
          {activeVariantKeys.map((key) => {
            const list = v[key] ?? []
            const presets = VARIANT_PRESETS[key]
            return (
              <div key={key} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{VARIANT_GROUP_LABELS[key]}</span>
                  <button
                    type="button"
                    onClick={() => removeVariantGroup(key)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Retirer
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePreset(key, p)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        list.includes(p)
                          ? "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-100"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-600"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={customByGroup[key] ?? ""}
                    onChange={(e) => setCustomByGroup((prev) => ({ ...prev, [key]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomVariant(key))}
                    placeholder="Valeur personnalisée…"
                    className="min-w-[8rem] flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  />
                  <button
                    type="button"
                    onClick={() => addCustomVariant(key)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
                  >
                    Ajouter
                  </button>
                </div>
                {list.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {list.map((val) => (
                      <span
                        key={val}
                        className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                      >
                        {val}
                        <button
                          type="button"
                          className="text-zinc-500 hover:text-red-600"
                          onClick={() =>
                            onVariantsChange(
                              mergeVariants(variants, {
                                [key]: list.filter((x) => x !== val).length
                                  ? list.filter((x) => x !== val)
                                  : undefined,
                              })
                            )
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}

          <div>
            <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Modèle / version</label>
            <input
              type="text"
              value={v.model ?? ""}
              onChange={(e) =>
                onVariantsChange(mergeVariants(variants, { model: e.target.value }))
              }
              placeholder="Ex. iPhone 15 Pro – édition 2025"
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>

          {colors.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Image par couleur (optionnel)</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                URL d’image affichée quand le client sélectionne la couleur sur la fiche produit.
              </p>
              <div className="mt-2 space-y-2">
                {colors.map((colorName) => (
                  <div key={colorName} className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="w-32 shrink-0 text-sm text-zinc-600 dark:text-zinc-400">{colorName}</span>
                    <input
                      type="url"
                      value={(v.imageByColor ?? {})[colorName] ?? ""}
                      onChange={(e) => {
                        const url = e.target.value.trim()
                        const cur = { ...(v.imageByColor ?? {}) }
                        if (url) cur[colorName] = url
                        else delete cur[colorName]
                        onVariantsChange(
                          mergeVariants(variants, {
                            imageByColor: Object.keys(cur).length ? cur : undefined,
                          })
                        )
                      }}
                      placeholder="https://…"
                      className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

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
            placeholder="Ajouter un tag (Entrée)"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={commitTag}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}
