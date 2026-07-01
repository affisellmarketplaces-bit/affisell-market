"use client"

import { Check } from "lucide-react"
import { useTranslations } from "next-intl"

import { STOREFRONT_HEADER_COLOR_SWATCHES } from "@/lib/storefront-header-chrome-shared"
import { normalizeHexColor } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  accent: string
  onChange: (hex: string) => void
}

export function StorefrontHeaderColorPicker({ value, accent, onChange }: Props) {
  const t = useTranslations("storefront.brandStudio")
  const normalized = normalizeHexColor(value) ?? "#18181b"
  const isCustomSwatch = !STOREFRONT_HEADER_COLOR_SWATCHES.some(
    (swatch) => swatch.toLowerCase() === normalized.toLowerCase()
  )

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("headerColor")}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{t("headerColorHint")}</p>
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-inner dark:border-zinc-700"
        style={{
          background: `linear-gradient(120deg, ${normalized}, color-mix(in srgb, ${normalized} 72%, ${accent}))`,
        }}
        aria-hidden
      >
        <div className="flex h-16 items-end justify-between px-4 pb-3">
          <span className="rounded-full border border-white/25 bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
            {t("headerColorPreview")}
          </span>
          <span className="font-mono text-xs font-medium text-white/90 drop-shadow-sm">{normalized}</span>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="listbox"
        aria-label={t("headerColorSwatchesAria")}
      >
        {STOREFRONT_HEADER_COLOR_SWATCHES.map((swatch) => {
          const selected = swatch.toLowerCase() === normalized.toLowerCase()
          return (
            <button
              key={swatch}
              type="button"
              role="option"
              aria-selected={selected}
              title={swatch}
              onClick={() => onChange(swatch)}
              className={cn(
                "relative size-10 shrink-0 rounded-xl border-2 transition duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500",
                selected ? "border-violet-500 ring-2 ring-violet-500/35" : "border-white/80 dark:border-zinc-600"
              )}
              style={{ backgroundColor: swatch }}
            >
              {selected ? (
                <Check
                  className={cn(
                    "absolute inset-0 m-auto size-4",
                    swatch === "#f8fafc" || swatch === "#faf5ff" ? "text-zinc-900" : "text-white"
                  )}
                  aria-hidden
                />
              ) : null}
              <span className="sr-only">{swatch}</span>
            </button>
          )
        })}
        <label
          className={cn(
            "relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 transition hover:scale-105",
            isCustomSwatch
              ? "border-violet-500 ring-2 ring-violet-500/35"
              : "border-dashed border-gray-300 dark:border-zinc-600"
          )}
          title={t("headerColorCustom")}
        >
          <input
            type="color"
            value={normalized}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={t("headerColorCustom")}
          />
          <span className="pointer-events-none text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            +
          </span>
        </label>
      </div>
    </div>
  )
}
