"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  logoUrl: string | null
  description?: string | null
  bannerUrl?: string | null
  theme?: StorefrontTheme
  /** When true, hide Affisell marketplace navigation (custom domain). */
  isCustomDomain?: boolean
}

export function ShopStoreHeader({
  storeName,
  logoUrl,
  description,
  bannerUrl,
  theme,
  isCustomDomain = false,
}: Props) {
  const t = useTranslations("boutique")
  const tNav = useTranslations("PublicNav")
  const accent = theme?.accent ?? "#7c3aed"

  return (
    <header className="border-b border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {bannerUrl ? (
        <div className="relative h-36 w-full overflow-hidden sm:h-44 md:h-52">
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
      ) : (
        <div
          className="h-2 w-full"
          style={{
            background: `linear-gradient(90deg, var(--store-primary, #18181b) 0%, ${accent} 100%)`,
          }}
          aria-hidden
        />
      )}

      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            width={48}
            height={48}
            className={cn(
              "h-14 w-14 shrink-0 rounded-2xl object-cover shadow-md sm:h-16 sm:w-16",
              bannerUrl
                ? "-mt-10 border-2 border-white dark:border-zinc-800 sm:-mt-12"
                : "border border-zinc-200 dark:border-zinc-700"
            )}
            loading="lazy"
          />
        ) : (
          <span
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md sm:h-16 sm:w-16",
              bannerUrl ? "-mt-10 border-2 border-white sm:-mt-12" : ""
            )}
            style={{ backgroundColor: accent }}
          >
            {storeName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {!isCustomDomain ? (
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("tagline")}</p>
          ) : (
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("customDomainTagline")}</p>
          )}
          <h1 className="truncate text-xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-2xl">{storeName}</h1>
          {description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        {!isCustomDomain ? (
          <div className="flex shrink-0 flex-wrap gap-3 text-sm font-medium">
            <Link
              href="/shops/browse"
              className="text-[color:var(--store-accent,#7c3aed)] underline-offset-2 hover:underline"
            >
              {tNav("marketplace")}
            </Link>
            <Link
              href="/shops"
              className="text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              {t("allStores")}
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  )
}
