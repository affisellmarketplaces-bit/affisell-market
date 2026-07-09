import type { Metadata } from "next"

import { AffiliateMarketingLandingPage } from "@/components/marketing/affiliate-landing-page"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Affisell Affiliate - Marge 300% | Programme Partenaire E-commerce",
  description:
    "Devenez affilié Affisell : marge jusqu'à 300% vs 10-30% TPOP/Shopify. Payout J+7 garanti. Zéro stock. Rejoignez 1000+ partenaires.",
  keywords:
    "affiliation e-commerce, marge 300%, programme partenaire, dropshipping France, TPOP alternative",
  openGraph: {
    title: "Affisell - Le programme affilié 300% marge",
    description: "Payout J+7. Zéro stock. Comparatif vs TPOP/Shopify.",
    images: ["/og-affiliate.png"],
  },
  robots: { index: true, follow: true },
}

export default function AffiliateLandingPage() {
  return <AffiliateMarketingLandingPage />
}
