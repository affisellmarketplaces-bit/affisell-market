import { Suspense } from "react"
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server"

import { HomeLcpPreloadBoundary } from "@/components/home/home-lcp-preload-boundary"
import { HomePage } from "@/components/home/HomePage"
import { FLAGS } from "@/lib/flags"
import { preloadHomeMarketplaceShell } from "@/lib/home-marketplace-shell"
import { resolveAppLocale } from "@/lib/i18n-locale"

/**
 * Buyer home (`/`) — ISR shell. Role redirects run in middleware.
 * Perf P0: LCP via eager×2 product imgs + HomeLcpPreload (inside Suspense — never on the first byte); TBT via idle MarketplaceView
 * + dynamic below-fold Radars; CLS via 44px sticky slot + affisell-product-media 4/3.
 */
export const revalidate = 60

export async function generateMetadata() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: "home.meta" })
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function Page() {
  const locale = await getLocale()
  setRequestLocale(locale)
  const appLocale = resolveAppLocale(locale)

  if (FLAGS.INSTANT_NAV_CACHE) {
    preloadHomeMarketplaceShell(appLocale)
  }

  return (
    <>
      {/*
        Suspense is what lets the page stream: without it this boundary — which awaits the catalogue (category tree,
        listings, offer counts, title cache) — held back the FIRST BYTE of the whole page. Measured in CI against a real
        PostgreSQL (lighthouse-mobile.yml › home-server-timing): first byte 120 ms with a local database, 700 ms with
        +150 ms per packet, 10.1 s with an unreachable one — hero included. The image preloads now stream in the same
        chunk as the catalogue they serve; the hero and the rest of the shell no longer wait for them.
      */}
      <Suspense fallback={null}>
        <HomeLcpPreloadBoundary locale={appLocale} />
      </Suspense>
      <HomePage />
    </>
  )
}
