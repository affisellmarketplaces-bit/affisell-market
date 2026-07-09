import type { Metadata } from "next"

import { BecomeSupplierPage } from "@/components/sell/become-supplier-page"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Vendre sur Affisell - Fournisseur E-commerce Europe | KYC 5min",
  description:
    "Devenez fournisseur Affisell : vendez en Europe sans stock. KYC 5min. Payout J+2 après expédition. 1000+ affiliés actifs.",
  keywords: "devenir fournisseur, marketplace Europe, vendre sans stock, B2B e-commerce",
  robots: { index: true, follow: true },
}

export default function SupplierLandingPage() {
  return <BecomeSupplierPage />
}
