"use client"

import { useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"

import {
  getProductRequestCountryGroups,
  PRODUCT_REQUEST_COUNTRIES,
  productRequestCountryChipLabel,
  sortProductRequestCountries,
} from "@/lib/product-request-types"
import { cn } from "@/lib/utils"

type PickerVariant = "violet" | "orange"

type ProductRequestCountryPickerProps = {
  selected: readonly string[]
  onChange: (codes: string[]) => void
  variant?: PickerVariant
  labelId: string
  title: string
  hint: string
  selectAllLabel: string
  resetLabel: string
  anyOriginLabel?: string
  /** When true, clearing all selections is allowed (provenance = flexible). */
  allowEmpty?: boolean
  onSelectAll?: () => void
  onReset?: () => void
}

const VARIANT_STYLES: Record<
  PickerVariant,
  {
    selected: string
    hover: string
    selectAll: string
    anySelected: string
    anyIdle: string
  }
> = {
  violet: {
    selected: "border-violet-500 bg-violet-600 text-white shadow-sm",
    hover: "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300 hover:bg-violet-50",
    selectAll: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
    anySelected: "border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-400/30",
    anyIdle: "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300 hover:bg-violet-50/60",
  },
  orange: {
    selected: "border-orange-500 bg-orange-600 text-white shadow-sm",
    hover: "border-zinc-200 bg-white text-zinc-600 hover:border-orange-300 hover:bg-orange-50",
    selectAll: "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100",
    anySelected: "border-orange-500 bg-orange-50 text-orange-950 ring-1 ring-orange-400/30",
    anyIdle: "border-zinc-200 bg-white text-zinc-600 hover:border-orange-300 hover:bg-orange-50/60",
  },
}

export function ProductRequestCountryPicker({
  selected,
  onChange,
  variant = "violet",
  labelId,
  title,
  hint,
  selectAllLabel,
  resetLabel,
  anyOriginLabel,
  allowEmpty = false,
  onSelectAll,
  onReset,
}: ProductRequestCountryPickerProps) {
  const t = useTranslations("productRequests")
  const countryGroups = useMemo(() => getProductRequestCountryGroups(), [])
  const styles = VARIANT_STYLES[variant]

  const toggleCountry = useCallback(
    (code: string) => {
      if (selected.includes(code)) {
        const next = selected.filter((c) => c !== code)
        if (allowEmpty || next.length > 0) onChange(next)
        return
      }
      onChange(sortProductRequestCountries([...selected, code]))
    },
    [allowEmpty, onChange, selected]
  )

  const handleSelectAll = useCallback(() => {
    if (onSelectAll) {
      onSelectAll()
      return
    }
    onChange([...PRODUCT_REQUEST_COUNTRIES])
  }, [onChange, onSelectAll])

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset()
      return
    }
    onChange(allowEmpty ? [] : ["FR"])
  }, [allowEmpty, onChange, onReset])

  const anyOrigin = allowEmpty && selected.length === 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-zinc-700" id={labelId}>
            {title}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {anyOriginLabel ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition",
                anyOrigin ? styles.anySelected : styles.anyIdle
              )}
            >
              {anyOriginLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSelectAll}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
              styles.selectAll
            )}
          >
            {selectAllLabel}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            {resetLabel}
          </button>
        </div>
      </div>
      <div
        className="mt-2 max-h-56 space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
        role="group"
        aria-labelledby={labelId}
      >
        {countryGroups.map((group) => (
          <div key={group.id}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              {t(`regions.${group.id}`)}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.codes.map((code) => {
                const isSelected = selected.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleCountry(code)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-xs font-semibold tabular-nums transition",
                      isSelected ? styles.selected : styles.hover
                    )}
                  >
                    {productRequestCountryChipLabel(code)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
