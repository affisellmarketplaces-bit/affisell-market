import { getLocale, getTranslations, setRequestLocale } from "next-intl/server"

import { HomeLcpPreloadBoundary } from "@/components/home/home-lcp-preload-boundary"
import { HomePage } from "@/components/home/HomePage"
import { resolveAppLocale } from "@/lib/i18n-locale"

/**
 * Buyer home (`/`) — ISR shell. Role redirects run in middleware.
 * Perf P0: LCP via eager×2 product imgs + HomeLcpPreload; TBT via idle MarketplaceView
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

  return (
    <>
      <HomeLcpPreloadBoundary locale={appLocale} />
      <HomePage />
    </>
  )
}
