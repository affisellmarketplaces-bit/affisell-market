"use client"

import { StorefrontTaglineBand } from "@/components/storefront/storefront-tagline-band"
import type {
  StorefrontHeaderBrandAlign,
  StorefrontTheme,
} from "@/lib/storefront-theme-shared"
import {
  isStorefrontImmersiveLayout,
  STOREFRONT_IMMERSIVE_HERO_CLASS,
} from "@/lib/storefront-immersive-shared"
import { cn } from "@/lib/utils"

type Props = {
  description?: string | null
  bannerUrl?: string | null
  theme?: StorefrontTheme
  brandAlign?: StorefrontHeaderBrandAlign
}

/** Hero strip for dedicated storefront hosts — no duplicate logo/name (buyer chrome handles that). */
export function StorefrontDedicatedHero({ description, bannerUrl, theme, brandAlign }: Props) {
  const accent = theme?.accent ?? "#7c3aed"
  const primary = theme?.primary ?? "#18181b"
  const heroStyle = theme?.heroStyle ?? "banner"
  const layout = theme?.layout ?? "classic"
  const headerAlign = brandAlign ?? theme?.headerBrandAlign ?? "center"
  const immersive = isStorefrontImmersiveLayout(layout)
  const heroVideoUrl = theme?.heroVideoUrl?.trim() ?? ""

  const showImageBanner = heroStyle === "banner" && Boolean(bannerUrl)
  const showGradientHero = heroStyle === "gradient"
  const showVideoHero = heroStyle === "video" && heroVideoUrl.length > 0
  const showHero = heroStyle !== "none" && (showImageBanner || showGradientHero || showVideoHero)

  if (!showHero && !description?.trim()) return null

  return (
    <section
      className={cn(
        "border-b border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950",
        immersive && STOREFRONT_IMMERSIVE_HERO_CLASS
      )}
    >
      {immersive ? (
        <>
          <div className="affisell-immersive-orb affisell-immersive-orb--left" aria-hidden />
          <div className="affisell-immersive-orb affisell-immersive-orb--right" aria-hidden />
        </>
      ) : null}
      {showImageBanner && bannerUrl ? (
        <div
          className={cn(
            "relative w-full overflow-hidden",
            immersive ? "h-44 sm:h-56 md:h-72" : "h-28 sm:h-36 md:h-40"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt=""
            className={cn(
              "h-full w-full object-cover",
              immersive && "affisell-immersive-ken-burns"
            )}
            loading="eager"
          />
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent",
              immersive && "from-black/65 via-black/20"
            )}
            aria-hidden
          />
          {immersive && description?.trim() ? (
            <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6 sm:pb-6">
              <p className="max-w-2xl text-base font-medium leading-relaxed text-white/95 drop-shadow-md sm:text-lg">
                {description}
              </p>
            </div>
          ) : null}
        </div>
      ) : showVideoHero ? (
        <div
          className={cn(
            "relative w-full overflow-hidden bg-zinc-950",
            immersive ? "h-48 sm:h-56 md:h-64" : "h-32 sm:h-40 md:h-48"
          )}
        >
          <video
            src={heroVideoUrl}
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={bannerUrl ?? undefined}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10"
            aria-hidden
          />
          {description?.trim() ? (
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3 sm:px-6 sm:pb-4">
              <p className="max-w-2xl text-sm font-medium leading-relaxed text-white/90 drop-shadow-sm sm:text-base">
                {description}
              </p>
            </div>
          ) : null}
        </div>
      ) : showGradientHero ? (
        <div
          className={cn(
            "relative w-full overflow-hidden",
            description?.trim()
              ? immersive
                ? "h-32 sm:h-40"
                : "h-20 sm:h-24"
              : immersive
                ? "h-16 sm:h-20"
                : "h-8 sm:h-10"
          )}
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${accent} 62%, color-mix(in srgb, ${accent} 35%, #000) 100%)`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.16),transparent_52%)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/15" />
          {description?.trim() ? (
            <div className="relative flex h-full items-end px-4 pb-3 sm:px-6 sm:pb-4">
              <p className="max-w-2xl text-sm font-medium leading-relaxed text-white/90 drop-shadow-sm sm:text-base">
                {description}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {description?.trim() && !showGradientHero && !showVideoHero && !(immersive && showImageBanner) ? (
        <StorefrontTaglineBand
          description={description}
          accent={accent}
          align={headerAlign}
          className="border-t-0 bg-transparent py-3 sm:py-4"
        />
      ) : null}
    </section>
  )
}
