import { getLocale, getTranslations, setRequestLocale } from "next-intl/server"

import { HomePage } from "@/components/home/HomePage"

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
  return <HomePage />
}
