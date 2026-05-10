"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export const CATEGORY_MULTI_JOINER = "|"

export type CategoryAttrRow = {
  id: string
  key: string
  label: string
  type: string
  unit: string | null
  options: string[]
  required: boolean
  order: number
}

/** Shown for every product; superseded if the category (or API) already defines the same key. */
export const CORE_SPEC_FIELDS_PRESET: CategoryAttrRow[] = [
  {
    id: "aff-core-brand",
    key: "brand",
    label: "Brand",
    type: "TEXT",
    unit: null,
    options: [],
    required: true,
    order: -300,
  },
  {
    id: "aff-core-size",
    key: "size",
    label: "Size",
    type: "TEXT",
    unit: null,
    options: [],
    required: false,
    order: -299,
  },
  {
    id: "aff-core-color",
    key: "color",
    label: "Colour",
    type: "TEXT",
    unit: null,
    options: [],
    required: false,
    order: -298,
  },
]

export function mergeCoreCategoryAttrs(categoryAttrs: CategoryAttrRow[]): CategoryAttrRow[] {
  const seen = new Set(categoryAttrs.map((a) => a.key.toLowerCase()))
  const prefix: CategoryAttrRow[] = []
  for (const c of CORE_SPEC_FIELDS_PRESET) {
    if (!seen.has(c.key.toLowerCase())) prefix.push(c)
  }
  const merged = [...prefix, ...categoryAttrs]
  merged.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  return merged
}

type Props = {
  attributes: CategoryAttrRow[]
  loading?: boolean
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
}

function normType(t: string | undefined): string {
  return (t ?? "TEXT").toUpperCase().replace(/\s+/g, "_")
}

export function splitMultiAttrValue(raw: string): string[] {
  return raw
    .split(CATEGORY_MULTI_JOINER)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinMulti(parts: string[]): string {
  return parts.join(CATEGORY_MULTI_JOINER)
}

function toggleMultiOption(current: string, opt: string): string {
  const set = new Set(splitMultiAttrValue(current))
  if (set.has(opt)) set.delete(opt)
  else set.add(opt)
  return joinMulti([...set].sort())
}

export function CategoryAttributeFields({ attributes, loading, values, onChange }: Props) {
  const setKey = (key: string, v: string) => {
    onChange({ ...values, [key]: v })
  }

  const sorted = [...attributes].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))

  if (attributes.length === 0) {
    return (
      <p className="text-xs text-amber-800 dark:text-amber-200">
        Add fields failed to load. Refresh the page or pick a category again.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Technical specifications</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Brand, size and colour</span> are always
        available; more fields appear for your category.{" "}
        <span className="text-red-600">*</span> Required · multi-select uses pill toggles.
      </p>
      {loading ? (
        <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">Loading extra fields for this aisle…</p>
      ) : null}
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((attr) => {
          const v = values[attr.key] ?? ""
          const labelSuffix = attr.unit ? ` (${attr.unit})` : ""
          const tp = normType(attr.type)

          const isSelect = tp === "SELECT" && attr.options.length > 0
          const isMulti = (tp === "MULTI_SELECT" || tp === "MULTI") && attr.options.length > 0
          const isBool = tp === "BOOLEAN" || tp === "YES_NO"
          const isTextarea = tp === "TEXTAREA" || tp === "LONG_TEXT"

          return (
            <div key={attr.id} className={cn("min-w-0", isTextarea && "sm:col-span-2 lg:col-span-3")}>
              <Label className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {attr.required ? <span className="text-red-600">*</span> : null}
                <span>
                  {attr.label}
                  {labelSuffix}
                </span>
                {!attr.required ? (
                  <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-500">(optional)</span>
                ) : null}
              </Label>

              {isMulti ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attr.options.map((opt) => {
                    const on = splitMultiAttrValue(v).includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setKey(attr.key, toggleMultiOption(v, opt))}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition",
                          on
                            ? "border-violet-500 bg-violet-500 text-white shadow-sm"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
                        )}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {isBool ? (
                <select
                  className={cn(
                    "mt-1.5 flex h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm shadow-sm",
                    "dark:border-zinc-700 dark:bg-zinc-950"
                  )}
                  value={v}
                  onChange={(e) => setKey(attr.key, e.target.value)}
                >
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : null}

              {isSelect ? (
                <select
                  className={cn(
                    "mt-1.5 flex h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm shadow-sm",
                    "dark:border-zinc-700 dark:bg-zinc-950"
                  )}
                  value={v}
                  onChange={(e) => setKey(attr.key, e.target.value)}
                >
                  <option value="">—</option>
                  {attr.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : null}

              {!isSelect && !isMulti && !isBool && isTextarea ? (
                <textarea
                  className={cn(
                    "mt-1.5 min-h-[88px] w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm shadow-sm",
                    "outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-950"
                  )}
                  value={v}
                  onChange={(e) => setKey(attr.key, e.target.value)}
                  placeholder={attr.options?.length ? attr.options.join(", ") : attr.label}
                />
              ) : null}

              {!isSelect && !isMulti && !isBool && !isTextarea ? (
                <Input
                  className="mt-1.5"
                  type={tp === "NUMBER" || tp === "DECIMAL" ? "number" : "text"}
                  value={v}
                  onChange={(e) => setKey(attr.key, e.target.value)}
                  placeholder={attr.options?.length ? attr.options.join(", ") : attr.label}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function missingRequiredCategorySpecs(
  defs: CategoryAttrRow[],
  values: Record<string, string>
): CategoryAttrRow[] {
  return defs.filter((a) => {
    if (!a.required) return false
    const raw = (values[a.key] ?? "").trim()
    const tp = normType(a.type)
    if (tp === "MULTI_SELECT" || tp === "MULTI") {
      return splitMultiAttrValue(raw).length === 0
    }
    return raw.length === 0
  })
}
