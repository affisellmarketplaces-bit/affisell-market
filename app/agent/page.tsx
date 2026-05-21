import { getTranslations } from "next-intl/server"

import AgentLocalePage from "@/app/[locale]/agent/page"

export async function generateMetadata() {
  const t = await getTranslations("agent")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

/** English buyer agent at `/agent` (same pattern as `/creators`). */
export default function AgentPage() {
  return <AgentLocalePage params={Promise.resolve({ locale: "en" })} />
}
