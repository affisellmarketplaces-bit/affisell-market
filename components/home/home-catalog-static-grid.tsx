import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { CatalogCardImage } from "@/components/home/catalog-card-image"
import {
  normalizeHomeCatalogProduct,
} from "@/lib/home-catalog-product-href"
import type { HomeMarketplaceShell } from "@/lib/home-marketplace-shell"

type Props = {
  shell: Pick<HomeMarketplaceShell, "products" | "catalogTotal">
  limit?: number
}

/** Server-rendered catalog grid — zero client JS until interactive explorer hydrates. */
export async function HomeCatalogStaticGrid({ shell, limit = 24 }: Props) {
  const t = await getTranslations("marketplace.browse")
  const tHub = await getTranslations("marketplace.mobileHub")
  const items = shell.products
    .map((product) => normalizeHomeCatalogProduct(product))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .slice(0, limit)

  if (items.length === 0) return null

  return (
    <div id="explorer" className="affisell-home-explorer min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
            {t("embeddedEyebrow")}
          </p>
          <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white sm:text-lg">
            {t("embeddedTitleMobile")}
          </h2>
        </div>
      </div>
      <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400 md:hidden">
        {tHub("listingShort", { count: shell.catalogTotal || items.length })}
      </p>
      <ul className="affisell-product-grid grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.id} className="flex h-full">
            <Link
              href={item.href}
              prefetch
              className="affisell-inp-tap affisell-home-static-card group flex h-full w-full touch-manipulation flex-col rounded-[1.35rem] border border-[color:var(--affisell-premium-border)] bg-[var(--affisell-premium-glass)] p-1.5 shadow-[var(--affisell-premium-shadow-soft)] transition-transform duration-200 active:scale-[0.99] sm:rounded-3xl sm:p-2"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-[1.1rem] border border-white/50 bg-gradient-to-br from-violet-50/50 via-white to-sky-50/35 sm:rounded-2xl dark:border-zinc-800/80 dark:from-violet-950/25 dark:via-zinc-950/80 dark:to-teal-950/15">
                <CatalogCardImage
                  src={item.image}
                  fallbackSrc={item.fallbackImage}
                  alt={item.title}
                  priority={index < 4}
                />
              </div>
              <div className="mt-1.5 px-0.5 pb-0.5 sm:mt-3 sm:px-1 sm:pb-1">
                <h3 className="line-clamp-2 min-h-[2.1rem] text-[12px] font-semibold leading-snug text-gray-900 sm:min-h-[2.5rem] sm:text-sm dark:text-zinc-100">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[1.15rem] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {item.priceLabel}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
