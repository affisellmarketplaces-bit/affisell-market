import { getLocale, getTranslations } from "next-intl/server"

import AgentLocalePage from "@/app/[locale]/agent/page"

export async function generateMetadata() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: "agent" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

/** Buyer agent at `/agent` — locale from cookie when URL has no prefix. */
export default async function AgentPage() {
  const locale = await getLocale()
  return <AgentLocalePage params={Promise.resolve({ locale })} />
}
