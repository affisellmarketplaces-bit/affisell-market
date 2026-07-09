import type { Metadata } from "next"

import { AffiliateMarketingLandingPage } from "@/components/marketing/affiliate-landing-page"

export const metadata: Metadata = {
  title: "Programme Affilié | Affisell — Marge jusqu'à 300%",
  description:
    "Fixez vos prix, gardez 75% de la marge. Vendez jusqu'à 300% du prix fournisseur avec payout Stripe J+7 et clawback prorata transparent.",
  robots: { index: true, follow: true },
}

export default function AffiliateLandingPage() {
  return <AffiliateMarketingLandingPage />
}
