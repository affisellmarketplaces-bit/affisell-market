import { getLocale, getTranslations, setRequestLocale } from "next-intl/server"

import { HomeLcpPreloadBoundary } from "@/components/home/home-lcp-preload-boundary"
import { HomePage } from "@/components/home/HomePage"
import { resolveAppLocale } from "@/lib/i18n-locale"

/** ISR shell — role redirects run in middleware on `/`. */
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
