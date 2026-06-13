"use client"

import { useTranslations } from "next-intl"

import type {
  StorefrontGridDensity,
  StorefrontHeaderBrandAlign,
  StorefrontHeroStyle,
  StorefrontLayoutMode,
  StorefrontSurface,
} from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
  onLayout: (v: StorefrontLayoutMode) => void
  onHeroStyle: (v: StorefrontHeroStyle) => void
  onGridDensity: (v: StorefrontGridDensity) => void
  onSurface: (v: StorefrontSurface) => void
  onHeaderBrandAlign: (v: StorefrontHeaderBrandAlign) => void
}

function OptionChip<T extends string>({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2 text-xs font-semibold transition",
        selected
          ? "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-100"
          : "border-gray-200 bg-white/70 text-gray-700 hover:border-gray-300 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-300"
      )}
    >
      {label}
    </button>
  )
}

export function StorefrontLayoutControls({
  layout,
  heroStyle,
  gridDensity,
  surface,
  headerBrandAlign,
  onLayout,
  onHeroStyle,
  onGridDensity,
  onSurface,
  onHeaderBrandAlign,
}: Props) {
  const t = useTranslations("storefront.brandStudio.layoutControls")

  return (
    <div className="space-y-5 rounded-2xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("title")}</p>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("headerBrand")}</p>
        <p className="text-[11px] text-gray-500 dark:text-zinc-500">{t("headerBrandHint")}</p>
        <div className="flex flex-wrap gap-2">
          {(["left", "center", "right"] as const).map((id) => (
            <OptionChip
              key={id}
              label={t(`headerBrandOptions.${id}`)}
              selected={headerBrandAlign === id}
              onClick={() => onHeaderBrandAlign(id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("layout")}</p>
        <div className="flex flex-wrap gap-2">
          {(["classic", "immersive", "minimal"] as const).map((id) => (
            <OptionChip
              key={id}
              label={t(`layoutOptions.${id}`)}
              selected={layout === id}
              onClick={() => onLayout(id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("hero")}</p>
        <div className="flex flex-wrap gap-2">
          {(["banner", "gradient", "none"] as const).map((id) => (
            <OptionChip
              key={id}
              label={t(`heroOptions.${id}`)}
              selected={heroStyle === id}
              onClick={() => onHeroStyle(id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("grid")}</p>
        <div className="flex flex-wrap gap-2">
          {(["cozy", "compact", "spacious"] as const).map((id) => (
            <OptionChip
              key={id}
              label={t(`gridOptions.${id}`)}
              selected={gridDensity === id}
              onClick={() => onGridDensity(id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("surface")}</p>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "glass"] as const).map((id) => (
            <OptionChip
              key={id}
              label={t(`surfaceOptions.${id}`)}
              selected={surface === id}
              onClick={() => onSurface(id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
