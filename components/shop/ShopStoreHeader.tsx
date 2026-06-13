"use client"

import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { LayoutGrid, Store } from "lucide-react"
import { useTranslations } from "next-intl"

import { StoreNameBadge } from "@/components/storefront/store-name-badge"
import type {
  StorefrontHeroStyle,
  StorefrontLayoutMode,
  StorefrontTheme,
} from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  logoUrl: string | null
  description?: string | null
  bannerUrl?: string | null
  theme?: StorefrontTheme
  /** When true, hide Affisell marketplace navigation (custom domain). */
  isCustomDomain?: boolean
  heroStyle?: StorefrontHeroStyle
  layout?: StorefrontLayoutMode
}

function StoreHeaderNavChip({
  href,
  icon: Icon,
  label,
  accent,
  variant = "marketplace",
}: {
  href: string
  icon: typeof LayoutGrid
  label: ReactNode
  accent: string
  variant?: "marketplace" | "stores"
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl border px-3 py-2.5",
        "text-xs font-bold uppercase tracking-[0.1em] transition duration-200 sm:flex-none sm:px-4 sm:text-[11px]",
        variant === "marketplace"
          ? "border-violet-500/30 bg-gradient-to-br from-violet-600/12 via-white to-indigo-500/10 text-violet-900 shadow-sm hover:border-violet-400/55 hover:shadow-md hover:shadow-violet-500/15 dark:from-violet-950/45 dark:via-zinc-950 dark:to-indigo-950/35 dark:text-violet-100"
          : "border-zinc-300/50 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white shadow-md hover:brightness-110 dark:border-zinc-600/60"
      )}
      style={
        variant === "stores"
          ? ({
              background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 88%, #18181b), color-mix(in srgb, ${accent} 55%, #000))`,
              borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
              boxShadow: `0 0 18px color-mix(in srgb, ${accent} 28%, transparent)`,
            } as CSSProperties)
          : undefined
      }
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
          variant === "marketplace"
            ? "bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.18),transparent_60%)]"
            : "bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_55%)]"
        )}
        aria-hidden
      />
      <Icon className="relative size-4 shrink-0 opacity-90" aria-hidden />
      <span className="relative truncate">{label}</span>
    </Link>
  )
}

export function ShopStoreHeader({
  storeName,
  logoUrl,
  description,
  bannerUrl,
  theme,
  isCustomDomain = false,
  heroStyle = "banner",
  layout = "classic",
}: Props) {
  const t = useTranslations("boutique")
  const tNav = useTranslations("PublicNav")
  const accent = theme?.accent ?? "#7c3aed"
  const primary = theme?.primary ?? "#18181b"
  const nameBadge = theme?.nameBadge ?? "parallelogram"

  const showImageBanner = heroStyle === "banner" && Boolean(bannerUrl)
  /** Banner mode without image → no empty placeholder strip (upload in Brand Studio). */
  const showGradientHero = heroStyle === "gradient"
  const hasHeroVisual = showImageBanner || showGradientHero
  const immersive = layout === "immersive"

  return (
    <header
      className={cn(
        "border-b border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950",
        immersive && "border-violet-200/40 dark:border-violet-900/40"
      )}
    >
      {showImageBanner && bannerUrl ? (
        <div
          className={cn(
            "relative w-full overflow-hidden",
            immersive ? "h-44 sm:h-56 md:h-64" : "h-36 sm:h-44 md:h-52"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
            aria-hidden
          />
        </div>
      ) : showGradientHero ? (
        <div
          className={cn(
            "relative flex w-full items-end overflow-hidden",
            description?.trim()
              ? immersive
                ? "h-28 sm:h-32"
                : "h-24 sm:h-28"
              : immersive
                ? "h-12 sm:h-14"
                : "h-10 sm:h-12"
          )}
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${accent} 55%, color-mix(in srgb, ${accent} 40%, #000) 100%)`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_55%)]" />
          {description?.trim() ? (
            <div className="relative mx-auto w-full max-w-6xl px-4 pb-3 sm:px-6 sm:pb-4">
              <p className="max-w-2xl text-sm font-medium leading-relaxed text-white/90 drop-shadow-sm">
                {description}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={cn("mx-auto max-w-6xl px-4 py-4 sm:px-6", immersive && "py-5 sm:py-6")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                width={48}
                height={48}
                className={cn(
                  "h-14 w-14 shrink-0 rounded-2xl object-cover shadow-md sm:h-16 sm:w-16",
                  hasHeroVisual
                    ? "-mt-10 border-2 border-white dark:border-zinc-800 sm:-mt-12"
                    : "border border-zinc-200 dark:border-zinc-700"
                )}
                loading="lazy"
              />
            ) : (
              <span
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md sm:h-16 sm:w-16",
                  hasHeroVisual ? "-mt-10 border-2 border-white sm:-mt-12" : ""
                )}
                style={{ backgroundColor: accent }}
              >
                {storeName.slice(0, 1).toUpperCase()}
              </span>
            )}

            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {!isCustomDomain ? t("tagline") : t("customDomainTagline")}
              </p>
              <div className="mt-1.5 max-w-full overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <StoreNameBadge
                  name={storeName}
                  style={nameBadge}
                  accent={accent}
                  primary={primary}
                  size="store"
                  className="max-w-full"
                />
              </div>
              {description && !showGradientHero ? (
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
              ) : null}
            </div>
          </div>

          {!isCustomDomain ? (
            <nav
              aria-label={t("navAria")}
              className="flex w-full shrink-0 gap-2 sm:gap-2.5 lg:w-auto lg:min-w-[18rem]"
            >
              <StoreHeaderNavChip
                href="/shops/browse"
                icon={LayoutGrid}
                label={tNav("marketplace")}
                accent={accent}
                variant="marketplace"
              />
              <StoreHeaderNavChip
                href="/shops"
                icon={Store}
                label={
                  <>
                    <span className="sm:hidden">{t("allStoresShort")}</span>
                    <span className="hidden sm:inline">{t("allStores")}</span>
                  </>
                }
                accent={accent}
                variant="stores"
              />
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  )
}
