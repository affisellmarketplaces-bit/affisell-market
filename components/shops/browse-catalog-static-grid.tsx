import { Fragment } from "react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { CatalogGridPrefetch } from "@/components/navigation/catalog-grid-prefetch"
import { CatalogCardImage } from "@/components/home/catalog-card-image"
import { normalizeHomeCatalogProduct } from "@/lib/home-catalog-product-href"
import { affisellBrand } from "@/lib/affisell-brand"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import { cn } from "@/lib/utils"

type Props = {
  shell: Pick<HomeMarketplaceShell, "products" | "catalogTotal">
  limit?: number
}

/** Standalone `/shops/browse` SSR — product cards visible before any client JS. */
export async function BrowseCatalogStaticGrid({ shell, limit = 24 }: Props) {
  const t = await getTranslations("marketplace.browse")
  const items = shell.products
    .map((product) => normalizeHomeCatalogProduct(product))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .slice(0, limit)

  return (
    <main
      id="browse-catalog"
      className="min-h-[calc(100dvh-3.75rem)] text-zinc-900 dark:text-zinc-50"
      data-testid="browse-catalog-static"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <header className={cn(affisellBrand.headerShell, "mb-8")}>
          <div className={affisellBrand.headerMesh} aria-hidden />
          <div className="relative space-y-2 p-6 sm:p-8">
            <p className={cn("text-xs font-semibold uppercase tracking-[0.14em]", affisellBrand.eyebrowBuyer)}>
              {t("eyebrowBuyer")}
            </p>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              {t("titleBuyer")}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-[15px]">
              {t("subtitleBuyer")}
            </p>
          </div>
        </header>

        {items.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("emptyCatalogBody")}</p>
        ) : (
          <CatalogGridPrefetch>
            <ul className="affisell-product-grid grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {items.map((item, index) => (
                <li key={item.id} className="flex h-full">
                  <Link
                    href={item.href}
                    prefetch
                    className="affisell-inp-tap affisell-home-static-card group flex h-full w-full touch-manipulation flex-col rounded-[1.35rem] border border-[color:var(--affisell-premium-border)] bg-[var(--affisell-premium-glass)] p-1.5 shadow-[var(--affisell-premium-shadow-soft)] transition-transform duration-200 active:scale-[0.99] sm:rounded-3xl sm:p-2"
                  >
                    <div className="affisell-product-media relative aspect-[4/3] w-full overflow-hidden rounded-[1.1rem] border border-white/50 bg-gradient-to-br from-violet-50/50 via-white to-sky-50/35 sm:rounded-2xl dark:border-zinc-800/80 dark:from-violet-950/25 dark:via-zinc-950/80 dark:to-teal-950/15">
                      <CatalogCardImage
                        src={item.image}
                        fallbackSrc={item.fallbackImage}
                        alt={item.title}
                        priority={index < 4}
                      />
                    </div>
                    <div className="mt-1.5 px-0.5 pb-0.5 sm:mt-3 sm:px-1 sm:pb-1">
                      <h2 className="line-clamp-2 min-h-[2.1rem] text-[12px] font-semibold leading-snug text-gray-900 sm:min-h-[2.5rem] sm:text-sm dark:text-zinc-100">
                        {item.title}
                      </h2>
                      <p className="mt-1.5 text-[1.125rem] font-black tracking-tight text-zinc-900 md:text-[1.15rem] dark:text-zinc-50">
                        {item.priceLabel}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CatalogGridPrefetch>
        )}
      </div>
    </main>
  )
}
