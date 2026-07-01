"use client"

import { Monitor, Smartphone } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { StorefrontBuyerChromeBar } from "@/components/storefront/storefront-buyer-chrome-bar"
import { StorefrontDedicatedHero } from "@/components/storefront/storefront-dedicated-hero"
import { StorefrontTaglineBand } from "@/components/storefront/storefront-tagline-band"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import {
  getEnabledHomepageSections,
  sectionCopyString,
  type HomepageSection,
} from "@/lib/storefront-sections-shared"
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
  trustRailText: string
  nameBadge: StoreNameBadgeStyle
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
  homepageSections: HomepageSection[]
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

const PREVIEW_CATEGORIES = [
  { id: "c1", slug: "beauty", name: "Health & Beauty", icon: "💄", count: 2 },
  { id: "c2", slug: "tech", name: "Electronics", icon: "⚡", count: 1 },
]

export function StorefrontLivePreview({ draft, className }: Props) {
  const t = useTranslations("storefront.brandStudio.preview")
  const tSections = useTranslations("storefront.homeSections")
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile")

  const theme: StorefrontTheme = {
    primary: draft.primary,
    accent: draft.accent,
    trustRailText: draft.trustRailText,
    nameBadge: draft.nameBadge,
    layout: draft.layout,
    heroStyle: draft.heroStyle,
    gridDensity: draft.gridDensity,
    surface: draft.surface,
    headerBrandAlign: draft.headerBrandAlign,
  }

  const bannerForHero =
    draft.heroStyle === "banner" && draft.bannerUrl.trim().length > 0
      ? draft.bannerUrl.trim()
      : null
  const enabledSections = getEnabledHomepageSections(draft.homepageSections)
  const sampleTagline = draft.description.trim() || t("sampleTagline")

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
          <StorefrontBuyerChromeBar
            storeName={draft.name.trim() || t("sampleName")}
            logoUrl={draft.logoUrl}
            accent={draft.accent}
            primary={draft.primary}
            trustRailText={draft.trustRailText}
            nameBadge={draft.nameBadge}
            headerBrandAlign={draft.headerBrandAlign}
            categories={PREVIEW_CATEGORIES}
            totalProducts={4}
            shopHomePath="/"
            isCustomDomain
            trust={{
              storeName: draft.name.trim() || t("sampleName"),
              partnerListingCode: "AFS-PREVIEW",
              merchantVerified: true,
              legalDisplayName: null,
              legalStatus: null,
              countryCode: null,
              verifiedAt: null,
            }}
          />
          {enabledSections.map((section) => {
            const content = section.content
            switch (section.type) {
              case "hero":
                if (draft.layout === "minimal") {
                  return sampleTagline ? (
                    <StorefrontTaglineBand
                      key="hero"
                      description={sampleTagline}
                      accent={draft.accent}
                      align={draft.headerBrandAlign}
                    />
                  ) : null
                }
                return (
                  <StorefrontDedicatedHero
                    key="hero"
                    description={sampleTagline}
                    bannerUrl={bannerForHero}
                    theme={theme}
                  />
                )
              case "story":
                return sampleTagline ? (
                  <div
                    key="story"
                    className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {sectionCopyString(content, "eyebrow", tSections("storyEyebrow"))}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {sectionCopyString(content, "body", sampleTagline)}
                    </p>
                  </div>
                ) : null
              case "bestsellers":
                return (
                  <div key="bestsellers" className="border-b border-zinc-200/80 px-3 py-3 dark:border-zinc-800">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                      {sectionCopyString(content, "eyebrow", tSections("bestsellersEyebrow"))}
                    </p>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                      {sectionCopyString(content, "title", tSections("bestsellersTitle"))}
                    </p>
                    <ul className="mt-2 flex gap-2 overflow-hidden">
                      {MOCK_TILES.slice(0, 3).map((tile) => (
                        <li
                          key={tile.id}
                          className={cn(
                            "h-16 w-14 shrink-0 rounded-lg bg-gradient-to-br",
                            tile.tone
                          )}
                        />
                      ))}
                    </ul>
                  </div>
                )
              case "products":
                return (
                  <div key="products" className="px-3 py-4">
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
                )
              case "social-proof":
                return (
                  <div
                    key="social-proof"
                    className="border-b border-zinc-200/80 bg-zinc-50/80 px-3 py-3 text-center dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <p className="text-[10px] italic text-zinc-700 dark:text-zinc-300">
                      &ldquo;{sectionCopyString(content, "quote", tSections("socialProofQuote"))}&rdquo;
                    </p>
                    <p className="mt-1 text-[9px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {sectionCopyString(content, "author", tSections("socialProofAuthor"))}
                    </p>
                  </div>
                )
              case "trust":
                return (
                  <div
                    key="trust"
                    className="border-y border-emerald-200/50 bg-emerald-50/40 px-3 py-2 text-[10px] font-medium text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
                  >
                    {sectionCopyString(content, "title", tSections("trustTitle"))} · AFS-PREVIEW
                  </div>
                )
              case "newsletter":
                return (
                  <div
                    key="newsletter"
                    className="border-y border-violet-200/60 bg-violet-50/50 px-3 py-3 text-center dark:border-violet-900/40 dark:bg-violet-950/20"
                  >
                    <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100">
                      {sectionCopyString(content, "title", tSections("newsletterTitle"))}
                    </p>
                    <div className="mx-auto mt-2 h-6 max-w-[180px] rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
                  </div>
                )
              case "cta":
                return (
                  <div
                    key="cta"
                    className="mx-3 mb-3 rounded-xl border border-violet-200/80 bg-violet-50/60 px-3 py-2 text-[10px] text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100"
                  >
                    {sectionCopyString(content, "title", tSections("ctaTitle"))} →
                  </div>
                )
              default:
                return null
            }
          })}
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-500 dark:text-zinc-400">{t("hint")}</p>
    </div>
  )
}
