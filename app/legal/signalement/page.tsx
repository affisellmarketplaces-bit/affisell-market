import type { Metadata } from "next"

import { DsaSignalementForm } from "@/components/legal/dsa-signalement-form"
import { LegalPageShell } from "@/components/legal/legal-page-shell"

export const metadata: Metadata = {
  title: "Signalement DSA | Affisell",
  description:
    "Point de contact pour signaler un contenu illicite sur Affisell Market — Règlement (UE) 2022/2065 (DSA), art. 16.",
}

export default function DsaSignalementPage() {
  return (
    <LegalPageShell
      title="Signalement de contenu (DSA)"
      description="Signalez un contenu ou une pratique que vous estimez illicite sur la marketplace Affisell. Nous accusons réception sous 24 heures et traitons votre demande conformément au Règlement sur les services numériques (DSA)."
    >
      <DsaSignalementForm />
    </LegalPageShell>
  )
}
