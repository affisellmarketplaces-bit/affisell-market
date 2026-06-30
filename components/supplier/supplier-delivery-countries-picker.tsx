"use client"

import { useMemo } from "react"

import type { DeliveryCountryPresetId } from "@/lib/supplier-delivery-countries"
import {
  DELIVERY_WORLDWIDE,
  deliveryCountryPresetCodes,
  supplierDeliveryCountryOptions,
} from "@/lib/supplier-delivery-countries"
import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { cn } from "@/lib/utils"

type Props = {
  value: string[]
  onChange: (codes: string[]) => void
  shippingCountry?: string
  locale?: "fr" | "en"
  className?: string
  hasError?: boolean
}

const PRESETS: Array<{ id: DeliveryCountryPresetId; labelFr: string; labelEn: string }> = [
  { id: "fr", labelFr: "France", labelEn: "France" },
  { id: "eu", labelFr: "Union européenne", labelEn: "European Union" },
  { id: "eu_plus", labelFr: "Europe élargie", labelEn: "Europe + UK/CH" },
  { id: "worldwide", labelFr: "Monde entier", labelEn: "Worldwide" },
]

export function SupplierDeliveryCountriesPicker({
  value,
  onChange,
  shippingCountry,
  locale = "fr",
  className,
  hasError = false,
}: Props) {
  const options = useMemo(() => supplierDeliveryCountryOptions(), [])
  const selected = new Set(value)
  const isWorldwide = selected.has(DELIVERY_WORLDWIDE)

  function toggleCode(code: string) {
    if (code === DELIVERY_WORLDWIDE) {
      onChange(selected.has(DELIVERY_WORLDWIDE) ? [] : [DELIVERY_WORLDWIDE])
      return
    }
    const next = new Set(value.filter((c) => c !== DELIVERY_WORLDWIDE))
    if (next.has(code)) next.delete(code)
    else next.add(code)
    onChange([...next].sort())
  }

  function applyPreset(preset: DeliveryCountryPresetId) {
    onChange(deliveryCountryPresetCodes(preset, shippingCountry))
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset.id)}
            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200"
          >
            {locale === "en" ? preset.labelEn : preset.labelFr}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "max-h-48 overflow-y-auto rounded-xl border p-3",
          hasError
            ? "border-red-500 ring-2 ring-red-500/20"
            : "border-zinc-200 dark:border-zinc-700"
        )}
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggleCode(DELIVERY_WORLDWIDE)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              isWorldwide
                ? "bg-emerald-600 text-white"
                : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            )}
          >
            {locale === "en" ? "Worldwide" : "Monde entier"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((code) => {
            const active = selected.has(code)
            return (
              <button
                key={code}
                type="button"
                disabled={isWorldwide}
                onClick={() => toggleCode(code)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition",
                  active
                    ? "bg-violet-600 text-white"
                    : "border border-zinc-300 text-zinc-700 hover:border-violet-400 dark:border-zinc-600 dark:text-zinc-300",
                  isWorldwide && "opacity-40"
                )}
              >
                {visitorCountryDisplayName(code, locale) ?? code}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {locale === "en"
          ? `${value.length} destination${value.length === 1 ? "" : "s"} selected — buyers outside this list cannot checkout.`
          : `${value.length} destination${value.length > 1 ? "s" : ""} sélectionnée${value.length > 1 ? "s" : ""} — les acheteurs hors liste ne pourront pas commander.`}
      </p>
    </div>
  )
}
