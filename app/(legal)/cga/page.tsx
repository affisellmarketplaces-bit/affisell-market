import type { Metadata } from "next"

import { CgaDocumentBody } from "@/components/legal/cga-document-body"
import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { CGA_VERSION } from "@/lib/legal/cga"

export const metadata: Metadata = {
  title: "CGA Fournisseur | Affisell",
  description:
    "Conditions générales fournisseur — commission 12 %, SLA 72h, pénalités stock, payout J+2, garantie produit.",
}

export default function CgaPage() {
  return (
    <LegalPageShell
      title="Conditions générales fournisseur (CGA)"
      description="Règles commerciales et opérationnelles pour les Suppliers sur Affisell."
      lastUpdated={CGA_VERSION}
    >
      <CgaDocumentBody />
    </LegalPageShell>
  )
}
