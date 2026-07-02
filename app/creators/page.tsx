import { getLocale, getTranslations } from "next-intl/server"

import CreatorsLocalePage from "@/app/[locale]/creators/page"

export async function generateMetadata() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: "creators.meta" })
  return { title: t("title"), description: t("description") }
}

/** Creators landing at `/creators` — locale from cookie when URL has no prefix. */
export default async function CreatorsPage() {
  const locale = await getLocale()
  return <CreatorsLocalePage params={Promise.resolve({ locale })} />
}
