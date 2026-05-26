import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LegalDocumentLayout } from "@/components/legal/legal-document-layout"
import { isLegalSlug, listLegalDocuments, loadLegalDocument, type LegalSlug } from "@/lib/legal/documents"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return listLegalDocuments().map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!isLegalSlug(slug)) return { title: "Document introuvable" }
  const { meta } = loadLegalDocument(slug)
  return { title: `${meta.title} | Affisell`, description: meta.description }
}

export default async function LegalSlugPage({ params }: Props) {
  const { slug } = await params
  if (!isLegalSlug(slug)) notFound()

  let doc
  try {
    doc = loadLegalDocument(slug as LegalSlug)
  } catch {
    notFound()
  }
  const allDocs = listLegalDocuments()

  return (
    <LegalDocumentLayout
      meta={doc.meta}
      content={doc.content}
      headings={doc.headings}
      allDocs={allDocs}
    />
  )
}
