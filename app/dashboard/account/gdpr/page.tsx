import Link from "next/link"
import { requireMerchantSession } from "@/lib/dashboard-session"
import { redirect } from "next/navigation"

import { BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { GdprAccountPanel } from "@/components/legal/gdpr-account-panel"

export const metadata = {
  title: "Données personnelles (RGPD) | Affisell",
}

export default async function GdprAccountPage() {
  const session = await requireMerchantSession("/dashboard/account/gdpr")


  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/dashboard/settings/account" className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
            ← Retour au compte
          </Link>
        </p>
        <BentoPageHeading
          eyebrow="RGPD"
          title="Mes données personnelles"
          description="Export, suppression de compte et gestion des consentements."
        />
        <GdprAccountPanel />
      </BentoContainer>
    </BentoShell>
  )
}
