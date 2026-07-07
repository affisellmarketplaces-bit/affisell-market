import { getLocale, getTranslations } from "next-intl/server"

import SellersLocalePage from "@/app/[locale]/sellers/page"

export async function generateMetadata() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: "sellers.meta" })
  return { title: t("title"), description: t("description") }
}

/** Seller / reseller landing at `/sellers`. */
export default async function SellersPage() {
  const locale = await getLocale()
  return <SellersLocalePage params={Promise.resolve({ locale })} />
}
