import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PartnersLanding } from "@/components/marketing/partners-landing"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partners.meta")
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("title"), description: t("description") },
  }
}

export default function PartnersPage() {
  return <PartnersLanding />
}
