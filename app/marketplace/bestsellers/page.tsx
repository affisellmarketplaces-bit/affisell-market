import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { BuyerBestsellersPage } from "@/components/buyer/buyer-bestsellers-page"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("buyerBestsellers")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default function MarketplaceBestsellersPage() {
  return <BuyerBestsellersPage />
}
