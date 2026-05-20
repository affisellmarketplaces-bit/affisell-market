import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { CreatorsLanding } from "@/components/marketing/creators-landing"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("creators.meta")
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("title"), description: t("description") },
  }
}

export default function CreatorsPage() {
  return <CreatorsLanding />
}
