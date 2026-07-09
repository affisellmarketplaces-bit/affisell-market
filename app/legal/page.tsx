import type { Metadata } from "next"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { LegalDocumentsRegistryTable } from "@/components/legal/legal-documents-registry-table"
import { listPublicLegalDocuments } from "@/lib/legal/public-documents-catalog"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Documents Légaux | Affisell",
  description:
    "Registre public des documents légaux Affisell — versions, dates effectives et empreintes SHA-256.",
  robots: { index: true, follow: true },
}

export default async function LegalRegistryPage() {
  const documents = await listPublicLegalDocuments("fr")

  return (
    <BentoShell>
      <BentoContainer maxWidth="6xl" className="py-10 sm:py-14">
        <header className="mb-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Transparence légale
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Documents Légaux Affisell
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Registre des versions en vigueur et empreintes cryptographiques (SHA-256) des documents
            contractuels publiés sur la plateforme.
          </p>
        </header>

        <LegalDocumentsRegistryTable documents={documents} />

        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Conformément au RGPD art.7, votre consentement est horodaté et traçable. DPO :{" "}
          <a
            href="mailto:dpo@affisell.com"
            className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            dpo@affisell.com
          </a>
        </p>

        <footer className="mt-6 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Dernière MAJ : 10/07/2026 — Engine v2.0.0
        </footer>
      </BentoContainer>
    </BentoShell>
  )
}
