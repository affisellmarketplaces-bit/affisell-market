import { getLocale, getTranslations } from "next-intl/server"

import PartnersLocalePage from "@/app/[locale]/partners/page"

export async function generateMetadata() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: "partners.meta" })
  return { title: t("title"), description: t("description") }
}

/** Partners landing at `/partners` — locale from cookie when URL has no prefix. */
export default async function PartnersPage() {
  const locale = await getLocale()
  return <PartnersLocalePage params={Promise.resolve({ locale })} />
}
