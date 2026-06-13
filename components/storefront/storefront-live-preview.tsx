"use client"

import { Monitor, Smartphone } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { ShopStoreHeader } from "@/components/shop/ShopStoreHeader"
import { StorefrontBuyerHeader } from "@/components/storefront/storefront-buyer-header"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import { StoreNameBadge } from "@/components/storefront/store-name-badge"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import {
  storefrontGridClass,
  storefrontSurfaceClass,
  type StorefrontGridDensity,
  type StorefrontHeaderBrandAlign,
  type StorefrontHeroStyle,
  type StorefrontLayoutMode,
  type StorefrontSurface,
  type StorefrontTheme,
} from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

export type StorefrontDraft = {
  name: string
  description: string
  bannerUrl: string
  logoUrl: string | null
  primary: string
  accent: string
  nameBadge: StoreNameBadgeStyle
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
}

type Props = {
  draft: StorefrontDraft
  className?: string
}

const MOCK_TILES = [
  { id: "1", tone: "from-violet-500/20 to-indigo-500/10" },
  { id: "2", tone: "from-emerald-500/15 to-teal-500/10" },
  { id: "3", tone: "from-fuchsia-500/15 to-pink-500/10" },
  { id: "4", tone: "from-amber-500/15 to-orange-500/10" },
]

export function StorefrontLivePreview({ draft, className }: Props) {
  const t = useTranslations("storefront.brandStudio.preview")
  const tChrome = useTranslations("storefront.buyerChrome")
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile")

  const theme: StorefrontTheme = {
    primary: draft.primary,
    accent: draft.accent,
    nameBadge: draft.nameBadge,
    layout: draft.layout,
    heroStyle: draft.heroStyle,
    gridDensity: draft.gridDensity,
    surface: draft.surface,
  }

  const showBanner =
    draft.heroStyle === "banner" && draft.bannerUrl.trim().length > 0
      ? draft.bannerUrl.trim()
      : null

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("title")}</p>
        <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-zinc-700">
          <button
            type="button"
            aria-pressed={viewport === "mobile"}
            onClick={() => setViewport("mobile")}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] font-semibold",
              viewport === "mobile"
                ? "bg-violet-600 text-white"
                : "text-gray-600 dark:text-zinc-400"
            )}
          >
            <Smartphone className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            aria-pressed={viewport === "desktop"}
            onClick={() => setViewport("desktop")}
            className={cn(
              "rounded-md px-2 py-1 text-[10px] font-semibold",
              viewport === "desktop"
                ? "bg-violet-600 text-white"
                : "text-gray-600 dark:text-zinc-400"
            )}
          >
            <Monitor className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "mx-auto overflow-hidden rounded-[1.75rem] border border-gray-200 shadow-2xl ring-1 ring-black/5 dark:border-zinc-700 dark:ring-white/10",
          viewport === "mobile" ? "max-w-[280px]" : "w-full"
        )}
      >
        <div className={cn("relative min-h-[420px]", storefrontSurfaceClass(draft.surface))}>
          <StorefrontThemeStyles theme={theme} />
          <StorefrontBuyerHeader
            storeName={draft.name.trim() || t("sampleName")}
            logoUrl={draft.logoUrl}
            accent={draft.accent}
            primary={draft.primary}
            nameBadge={draft.nameBadge}
            headerBrandAlign={draft.headerBrandAlign}
            menuLabel={tChrome("openCategories")}
            cartLabel={tChrome("cart")}
            compact
          />
          {draft.layout === "minimal" ? (
            <div className="border-b border-zinc-200/80 px-4 py-4 dark:border-zinc-800">
              <StoreNameBadge
                name={draft.name.trim() || t("sampleName")}
                style={draft.nameBadge}
                accent={draft.accent}
                primary={draft.primary}
                size="store"
              />
            </div>
          ) : (
            <ShopStoreHeader
              storeName={draft.name.trim() || t("sampleName")}
              logoUrl={draft.logoUrl}
              description={draft.description.trim() || t("sampleTagline")}
              bannerUrl={
                draft.heroStyle === "none"
                  ? null
                  : draft.heroStyle === "gradient"
                    ? null
                    : showBanner
              }
              theme={theme}
              isCustomDomain
              heroStyle={draft.heroStyle}
              layout={draft.layout}
            />
          )}

          <div className="px-3 py-4">
            <ul className={storefrontGridClass(draft.gridDensity)}>
              {MOCK_TILES.map((tile) => (
                <li
                  key={tile.id}
                  className={cn(
                    "aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br shadow-sm",
                    tile.tone
                  )}
                >
                  <div className="flex h-full flex-col justify-end p-2">
                    <span className="h-2 w-2/3 rounded bg-white/30" />
                    <span className="mt-1 h-2 w-1/3 rounded bg-white/20" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-500 dark:text-zinc-400">{t("hint")}</p>
    </div>
  )
}
