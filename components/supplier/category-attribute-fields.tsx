"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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

type Props = {
  attributes: CategoryAttrRow[]
  loading?: boolean
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
}

export function CategoryAttributeFields({ attributes, loading, values, onChange }: Props) {
  if (loading) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading category fields…</p>
    )
  }

  if (attributes.length === 0) {
    return null
  }

  const setKey = (key: string, v: string) => {
    onChange({ ...values, [key]: v })
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Characteristics</h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="text-red-600">*</span> Required · others are optional.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {attributes.map((attr) => {
          const v = values[attr.key] ?? ""
          const labelSuffix = attr.unit ? ` (${attr.unit})` : ""
          const isSelect = attr.type?.toUpperCase() === "SELECT" && attr.options.length > 0

          return (
            <div key={attr.id} className="min-w-0">
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
              ) : (
                <Input
                  className="mt-1.5"
                  type={attr.type?.toUpperCase() === "NUMBER" ? "number" : "text"}
                  value={v}
                  onChange={(e) => setKey(attr.key, e.target.value)}
                  placeholder={attr.options?.length ? attr.options.join(", ") : attr.label}
                />
              )}
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
  return defs.filter((a) => a.required && !(values[a.key] ?? "").trim())
}
