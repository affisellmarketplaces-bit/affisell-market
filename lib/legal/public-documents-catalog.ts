import "server-only"

import { prisma } from "@/lib/prisma"
import {
  PUBLIC_LEGAL_CATALOG_SLUGS,
  PUBLIC_LEGAL_NAMES,
  type PublicLegalDocumentSummary,
} from "@/lib/legal/public-documents-catalog-shared"

export {
  PUBLIC_LEGAL_CATALOG_SLUGS,
  PUBLIC_LEGAL_NAMES,
  PUBLIC_LEGAL_READ_PATHS,
  type PublicLegalCatalogSlug,
  type PublicLegalDocumentSummary,
} from "@/lib/legal/public-documents-catalog-shared"

function formatEffectiveDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function listPublicLegalDocuments(
  locale = "fr"
): Promise<PublicLegalDocumentSummary[]> {
  const docs = await prisma.legalDocument.findMany({
    where: { slug: { in: [...PUBLIC_LEGAL_CATALOG_SLUGS] } },
    include: {
      currentVersion: {
        select: {
          version: true,
          contentHash: true,
          effectiveAt: true,
          publishedAt: true,
          language: true,
        },
      },
    },
  })

  const bySlug = new Map(docs.map((d) => [d.slug, d]))

  return PUBLIC_LEGAL_CATALOG_SLUGS.flatMap((slug) => {
    const doc = bySlug.get(slug)
    const version = doc?.currentVersion
    if (!doc || !version) return []

    return [
      {
        slug,
        name: PUBLIC_LEGAL_NAMES[slug],
        version: version.version,
        hash: version.contentHash,
        effectiveDate: formatEffectiveDate(version.effectiveAt ?? version.publishedAt),
        downloadUrl: `/api/legal/document/${slug}?locale=${locale}`,
      },
    ]
  })
}
