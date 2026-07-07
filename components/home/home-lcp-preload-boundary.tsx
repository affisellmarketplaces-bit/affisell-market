import { preload } from "react-dom"

import { HomeCatalogLcpPreload } from "@/components/home/home-catalog-lcp-preload"
import type { AppLocale } from "@/lib/i18n-locale"
import { pickHomeLcpImageUrls } from "@/lib/home-lcp-images"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"

type Props = {
  locale: AppLocale
}

/**
 * Hoisted LCP preloads — runs in parallel with hero Suspense, before catalog boundary.
 */
export async function HomeLcpPreloadBoundary({ locale }: Props) {
  const shell = await loadHomeMarketplaceShellSafe(locale)
  const urls = pickHomeLcpImageUrls(shell.products, 4)

  for (const href of urls) {
    try {
      preload(href, { as: "image", fetchPriority: "high" })
    } catch (error) {
      console.log("[home-lcp-preload]", { href, error })
    }
  }

  return <HomeCatalogLcpPreload products={shell.products} />
}
