import { getLocale, getTranslations } from "next-intl/server"

import EnterpriseLocalePage from "@/app/[locale]/enterprise/page"

export async function generateMetadata() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: "enterprise.meta" })
  return { title: t("title"), description: t("description") }
}

/** Enterprise brands landing at `/enterprise` — locale from cookie when URL has no prefix. */
export default async function EnterprisePage() {
  const locale = await getLocale()
  return <EnterpriseLocalePage params={Promise.resolve({ locale })} />
}
