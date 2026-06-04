import type { Metadata } from "next"

import { CguDocumentBody } from "@/components/legal/cgu-document-body"
import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { CGU_VERSION } from "@/lib/legal/cgu"

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation | Affisell",
  description: "CGU Affisell — marketplace tripartite, compte, paiements, responsabilité.",
}

export default function CguPage() {
  return (
    <LegalPageShell
      title="Conditions générales d'utilisation (CGU)"
      description="Règles d'accès et d'utilisation de la plateforme Affisell."
      lastUpdated={CGU_VERSION}
    >
      <CguDocumentBody />
    </LegalPageShell>
  )
}
