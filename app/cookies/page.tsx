import type { Metadata } from "next"

import { CookiesSettingsClient } from "@/components/cookies/cookies-settings-client"
import { LegalPageShell } from "@/components/legal/legal-page-shell"

export const metadata: Metadata = {
  title: "Gestion des cookies | Affisell",
  description: "Paramétrage des cookies analytics et essentiels — conformité CNIL 2024.",
}

const LAST_UPDATED = "2026-06-03"

export default function CookiesPage() {
  return (
    <LegalPageShell
      title="Gestion des cookies"
      description="Choisissez les traceurs autorisés. Aucun cookie non essentiel avant votre action."
      lastUpdated={LAST_UPDATED}
    >
      <CookiesSettingsClient />
    </LegalPageShell>
  )
}
