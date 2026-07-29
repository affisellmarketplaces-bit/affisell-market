import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { BattlesHubExperience } from "@/components/battles/battles-hub-experience"
import { loadBattlesHub } from "@/lib/battles-hub-data.server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("battles")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function BattlesHubPage() {
  const initial = await loadBattlesHub()
  return <BattlesHubExperience initial={initial} />
}
