import type { Metadata } from "next"

import { CgaDocumentBody } from "@/components/legal/cga-document-body"
import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { CGA_VERSION } from "@/lib/legal/cga"

export const metadata: Metadata = {
  title: "Conditions fournisseur | Affisell",
  description:
    "Conditions générales fournisseur — frais catalogue / auto-buy, SLA 72h, pénalités stock, Stripe Connect, garantie produit.",
}

export default function ConditionsFournisseurPage() {
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
