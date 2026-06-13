"use client"

import type { StorefrontHeroStyle, StorefrontLayoutMode, StorefrontTheme } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  description?: string | null
  bannerUrl?: string | null
  theme?: StorefrontTheme
}

/** Hero strip for dedicated storefront hosts — no duplicate logo/name (buyer chrome handles that). */
export function StorefrontDedicatedHero({ description, bannerUrl, theme }: Props) {
  const accent = theme?.accent ?? "#7c3aed"
  const primary = theme?.primary ?? "#18181b"
  const heroStyle = theme?.heroStyle ?? "banner"
  const layout = theme?.layout ?? "classic"
  const immersive = layout === "immersive"

  const showImageBanner = heroStyle === "banner" && Boolean(bannerUrl)
  const showGradientHero =
    heroStyle === "gradient" || (heroStyle === "banner" && !bannerUrl)
  const showHero = heroStyle !== "none" && (showImageBanner || showGradientHero)

  if (!showHero && !description?.trim()) return null

  return (
    <section className="border-b border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {showImageBanner && bannerUrl ? (
        <div
          className={cn(
            "relative w-full overflow-hidden",
            immersive ? "h-36 sm:h-44 md:h-52" : "h-28 sm:h-36 md:h-40"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" loading="eager" />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent"
            aria-hidden
          />
        </div>
      ) : showGradientHero ? (
        <div
          className={cn(
            "relative w-full overflow-hidden",
            immersive ? "h-24 sm:h-28" : "h-16 sm:h-20"
          )}
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${accent} 62%, color-mix(in srgb, ${accent} 35%, #000) 100%)`,
          }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.16),transparent_52%)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/15" />
        </div>
      ) : null}

      {description?.trim() ? (
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
      ) : null}
    </section>
  )
}
