import { redirect } from "next/navigation"

import { BentoContainer, BentoPageHeading } from "@/components/affisell/bento-ui"
import { GdprAccountPanel } from "@/components/legal/gdpr-account-panel"
import { auth } from "@/auth"

export const metadata = {
  title: "Données personnelles (RGPD) | Affisell",
}

export default async function MarketplaceBuyerGdprPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/marketplace/account/gdpr")
  }

  return (
    <BentoContainer maxWidth="4xl" className="space-y-8">
      <BentoPageHeading
        eyebrow="RGPD"
        title="Mes données personnelles"
        description="Export, suppression de compte et gestion des consentements (cookies, analytics)."
      />
      <GdprAccountPanel />
    </BentoContainer>
  )
}
