import { Fragment } from "react"
import { getTranslations } from "next-intl/server"

import { CatalogCard } from "@/components/catalog-card"
import { CatalogGridPrefetch } from "@/components/navigation/catalog-grid-prefetch"
import { CatalogCardImage } from "@/components/home/catalog-card-image"
import { HomeWorldRadarInlineLazy } from "@/components/home/home-world-radar-inline-lazy"
import {
  normalizeHomeCatalogProduct,
} from "@/lib/home-catalog-product-href"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"

type Props = {
  shell: Pick<HomeMarketplaceShell, "products" | "catalogTotal">
  limit?: number
}

export async function HomeCatalogStaticGrid({ shell, limit = 20 }: Props) {
  const t = await getTranslations("marketplace.browse")
  const tHub = await getTranslations("marketplace.mobileHub")
  const items = shell.products
   .map((product) => normalizeHomeCatalogProduct(product))
   .filter((row): row is NonNullable<typeof row> => row!= null)
   .slice(0, limit)

  if (items.length === 0) return null

  return (
    <div id="explorer" className="affisell-home-explorer min-w-0">
      <div className="mb-2 h-11 md:hidden" aria-hidden />
      <div className="mb-1.5 hidden items-center justify-between gap-2 md:flex">
        <div>
          <p className="text- font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
            {t("embeddedEyebrow")}
          </p>
          <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg">
            {t("embeddedTitleMobile")}
          </h2>
        </div>
      </div>
      <p className="mb-1.5 hidden text- text-zinc-500 dark:text-zinc-400 md:block">
        {tHub("listingShort", { count: shell.catalogTotal || items.length })}
      </p>
      <CatalogGridPrefetch>
        <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => (
            <Fragment key={item.id}>
              <li className="min-w-0">
                <CatalogCard
                  href={item.href}
                  prefetch
                  className="group flex min-w-0 flex-col rounded-[1.35rem] border border-[color:var(--affisell-premium-border)] bg-[var(--affisell-premium-glass)] p-1 shadow-[var(--affisell-premium-shadow-soft)] transition-transform duration-200 active:scale-[0.99] sm:rounded-3xl sm:p-1.5"
                >
                  <div className="relative flex aspect-square w-full min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-[1.1rem] border border-white/50 bg-gradient-to-br from-violet-50/50 via-white to-sky-50/35 sm:rounded-2xl dark:border-zinc-800/80 dark:from-violet-950/25 dark:via-zinc-950/80 dark:to-teal-950/15">
                    <CatalogCardImage
                      src={item.image}
                      fallbackSrc={item.fallbackImage}
                      alt={item.title}
                      priority={index < 4}
                    />
                  </div>
                  <div className="mt-1.5 min-w-0 px-0.5 pb-0.5 sm:mt-3 sm:px-1 sm:pb-1">
                    <h3 className="line-clamp-2 min-h-[2.1rem] text- font-semibold leading-snug text-gray-900 sm:min-h-[2.5rem] sm:text-sm dark:text-zinc-100">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-[1.125rem] font-black tracking-tight text-zinc-900 md:text-[1.15rem] dark:text-zinc-50">
                      {item.priceLabel}
                    </p>
                  </div>
                </CatalogCard>
              </li>
              {index === 3? (
                <li className="col-span-2 md:hidden">
                  <HomeWorldRadarInlineLazy />
                </li>
              ) : null}
            </Fragment>
          ))}
        </ul>
      </CatalogGridPrefetch>
    </div>
  )
}