import type { Metadata } from "next"

import { LegalMarkdown } from "@/components/legal/legal-markdown"
import { LegalPageShell } from "@/components/legal/legal-page-shell"
import {
  loadLocalizedLegalDocumentForRequest,
  type LocalizedLegalSlug,
} from "@/lib/legal/localized-content"

type Props = {
  slug: LocalizedLegalSlug
  children?: React.ReactNode
}

export async function generateLocalizedLegalMetadata(slug: LocalizedLegalSlug): Promise<Metadata> {
  const doc = await loadLocalizedLegalDocumentForRequest(slug)
  return {
    title: `${doc.meta.title} | Affisell`,
    description: doc.meta.description,
  }
}

export async function LocalizedLegalPage({ slug, children }: Props) {
  const doc = await loadLocalizedLegalDocumentForRequest(slug)

  return (
    <LegalPageShell
      title={doc.meta.title}
      description={doc.meta.description}
      lastUpdated={doc.meta.lastUpdated}
    >
      {children ?? <LegalMarkdown content={doc.content} />}
    </LegalPageShell>
  )
}
