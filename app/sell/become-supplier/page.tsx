import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { BecomeSupplierPage } from "@/components/sell/become-supplier-page"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sellBecomeSupplier.meta")
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  }
}

/** B2B supplier onboarding brief — not indexed (accountants / due diligence). */
export default function SellBecomeSupplierPage() {
  return <BecomeSupplierPage />
}
