import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { LegalDocumentLayout } from "@/components/legal/legal-document-layout"
import { LEGAL_MARKDOWN_CANONICAL_REDIRECTS } from "@/lib/legal/markdown-canonical-redirects"
import {
  isLegalSlug,
  listLegalDocuments,
  loadLegalDocument,
  type LegalSlug,
} from "@/lib/legal/documents"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return listLegalDocuments("fr").map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!isLegalSlug(slug)) return { title: "Document introuvable" }
  const locale = await resolveRequestLocale(undefined)
  const { meta } = loadLegalDocument(slug, locale)
  return { title: `${meta.title} | Affisell`, description: meta.description }
}

export default async function LegalSlugPage({ params }: Props) {
  const { slug } = await params
  const canonical = LEGAL_MARKDOWN_CANONICAL_REDIRECTS[slug]
  if (canonical) {
    redirect(canonical)
  }
  if (!isLegalSlug(slug)) notFound()

  const locale = await resolveRequestLocale(undefined)
  let doc
  try {
    doc = loadLegalDocument(slug as LegalSlug, locale)
  } catch {
    notFound()
  }
  const allDocs = listLegalDocuments(locale)

  return (
    <LegalDocumentLayout
      meta={doc.meta}
      content={doc.content}
      headings={doc.headings}
      allDocs={allDocs}
    />
  )
}
