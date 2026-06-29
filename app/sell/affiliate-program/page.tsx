import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AffiliateProgramPage } from "@/components/sell/affiliate-program-page"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sellAffiliateProgram.meta")
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  }
}

/** B2B partner program brief — anti-URSSAF, not indexed. */
export default function SellAffiliateProgramPage() {
  return <AffiliateProgramPage />
}
