"use client"

import { useTranslations } from "next-intl"

import { STOREFRONT_THEME_PRESETS } from "@/lib/storefront-theme-presets"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  value: string | null
  onApply: (theme: StorefrontTheme, presetId: string) => void
}

export function StorefrontThemePresetPicker({ value, onApply }: Props) {
  const t = useTranslations("storefront.brandStudio.presets")

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("title")}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{t("hint")}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {STOREFRONT_THEME_PRESETS.map((preset) => {
          const selected = value === preset.id
          const { primary, accent } = preset.theme
          return (
            <li key={preset.id}>
              <button
                type="button"
                onClick={() => onApply(preset.theme, preset.id)}
                className={cn(
                  "group flex w-full flex-col overflow-hidden rounded-2xl border text-left transition",
                  selected
                    ? "border-violet-500 ring-2 ring-violet-500/30"
                    : "border-gray-200 hover:border-violet-300 dark:border-zinc-700 dark:hover:border-violet-700"
                )}
              >
                <div
                  className="h-14 w-full"
                  style={{
                    background: `linear-gradient(135deg, ${primary ?? "#18181b"}, ${accent ?? "#7c3aed"})`,
                  }}
                  aria-hidden
                />
                <div className="space-y-0.5 px-3 py-2.5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                    {t(`items.${preset.id}.name`)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                    {t(`items.${preset.id}.desc`)}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
