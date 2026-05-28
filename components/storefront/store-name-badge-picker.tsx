"use client"

import { useTranslations } from "next-intl"

import { StoreNameBadge } from "@/components/storefront/store-name-badge"
import {
  STORE_NAME_BADGE_CATALOG,
  type StoreNameBadgeStyle,
} from "@/lib/store-name-badge-styles"
import { cn } from "@/lib/utils"

type Props = {
  value: StoreNameBadgeStyle
  onChange: (style: StoreNameBadgeStyle) => void
  previewName: string
  accent: string
  primary: string
}

export function StoreNameBadgePicker({ value, onChange, previewName, accent, primary }: Props) {
  const t = useTranslations("storefront.brandStudio.nameBadges")

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("sectionTitle")}</p>
      <p className="text-sm text-gray-600 dark:text-zinc-400">{t("sectionHint")}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {STORE_NAME_BADGE_CATALOG.map((item) => {
          const selected = value === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-2xl border p-3 text-left transition",
                  selected
                    ? "border-violet-500 bg-violet-50/80 ring-2 ring-violet-500/30 dark:border-violet-500 dark:bg-violet-950/40"
                    : "border-gray-200 bg-white/60 hover:border-gray-300 dark:border-zinc-700 dark:bg-zinc-950/50"
                )}
              >
                <div className="min-h-[3rem] overflow-hidden rounded-xl bg-zinc-900/95 px-3 py-3">
                  <StoreNameBadge
                    name={previewName || "Ecom Store"}
                    style={item.id}
                    accent={accent}
                    primary={primary}
                    size="preview"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                    {t(item.labelKey)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{t(item.descriptionKey)}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
