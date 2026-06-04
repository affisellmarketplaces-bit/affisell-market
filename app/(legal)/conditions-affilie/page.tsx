import type { Metadata } from "next"

import { CgsDocumentBody } from "@/components/legal/cgs-document-body"
import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { CGS_VERSION } from "@/lib/legal/cgs"

export const metadata: Metadata = {
  title: "Conditions affilié | Affisell",
  description:
    "Conditions générales affilié — frais plateforme sur gains, Loi Influenceurs, publicité loyale, seuil 5 000 €/an, Stripe Connect.",
}

export default function ConditionsAffiliePage() {
  return (
    <LegalPageShell
      title="Conditions générales de services — Affilié (CGS)"
      description="Règles pour les créateurs et partenaires Affiliates sur Affisell."
      lastUpdated={CGS_VERSION}
    >
      <CgsDocumentBody />
    </LegalPageShell>
  )
}
