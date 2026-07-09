/**
 * Idempotent LMS seed — imports legal/content/ into LegalDocument + LegalVersion.
 *
 *   npm run legal:seed
 */

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { config } from "dotenv"
import { LegalDocumentType, PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const

const DOCS = [
  {
    slug: "customer",
    type: "CGU",
    category: "agreement",
    requiresAccept: true,
    title: "Conditions Générales d'Utilisation",
    contentFile: "terms-of-service",
  },
  {
    slug: "terms-of-sale",
    type: "CGV",
    category: "agreement",
    requiresAccept: true,
    title: "Conditions Générales de Vente",
    contentFile: "terms-of-sale",
  },
  {
    slug: "supplier",
    type: "SUPPLIER_AGREEMENT",
    category: "agreement",
    requiresAccept: true,
    title: "Conditions Fournisseur",
    contentFile: "terms-supplier",
  },
  {
    slug: "affiliate",
    type: "AFFILIATE_AGREEMENT",
    category: "agreement",
    requiresAccept: true,
    title: "Conditions Affilié",
    contentFile: "terms-affiliate",
  },
  {
    slug: "privacy",
    type: "PRIVACY_POLICY",
    category: "policy",
    requiresAccept: true,
    title: "Politique de Confidentialité",
    contentFile: "privacy-policy",
  },
  {
    slug: "cookies",
    type: "COOKIES_POLICY",
    category: "policy",
    requiresAccept: false,
    title: "Politique Cookies",
    contentFile: "cookies-policy",
  },
  {
    slug: "refunds",
    type: "REFUND_POLICY",
    category: "policy",
    requiresAccept: false,
    title: "Politique Remboursement",
    contentFile: "refund-policy",
  },
  {
    slug: "legal-notice",
    type: "LEGAL_NOTICE",
    category: "policy",
    requiresAccept: false,
    title: "Mentions Légales",
    contentFile: "mentions",
  },
  {
    slug: "affisell-plus",
    type: "AFFISELL_PLUS",
    category: "policy",
    requiresAccept: false,
    title: "Affisell Plus",
    contentFile: "affisell-plus",
  },
  {
    slug: "payments",
    type: "PAYMENTS_POLICY",
    category: "policy",
    requiresAccept: false,
    title: "Politique Paiements",
    contentFile: null,
  },
  {
    slug: "dac7",
    type: "DAC7_POLICY",
    category: "policy",
    requiresAccept: false,
    title: "DAC7",
    contentFile: null,
  },
  {
    slug: "vat",
    type: "VAT_POLICY",
    category: "policy",
    requiresAccept: false,
    title: "TVA",
    contentFile: null,
  },
] as const

const PLACEHOLDER_CONTENT: Record<string, string> = {
  payments: `---
title: Politique Paiements
lastUpdated: 2026-07-09
---

# Politique Paiements

Version 1.0.0 — document LMS Phase 2.1. Contenu détaillé à publier en Phase 3.
`,
  dac7: `---
title: DAC7
lastUpdated: 2026-07-09
---

# Disclosure DAC7

Version 1.0.0 — document LMS Phase 2.1. Seuils : 2 000 € ou 30 transactions / an.
`,
  vat: `---
title: TVA
lastUpdated: 2026-07-09
---

# Politique TVA

Version 1.0.0 — document LMS Phase 2.1. TVA collectée via Stripe Tax au checkout.
`,
}

function contentPath(locale: string, contentFile: string): string {
  return path.join(process.cwd(), "legal", "content", locale, `${contentFile}.md`)
}

function loadContent(
  doc: (typeof DOCS)[number],
  locale: string
): string | null {
  if (doc.contentFile === null) {
    return PLACEHOLDER_CONTENT[doc.slug] ?? null
  }

  const localized = contentPath(locale, doc.contentFile)
  if (existsSync(localized)) {
    return readFileSync(localized, "utf8")
  }

  if (locale !== "fr") {
    const frCanonical = contentPath("fr", doc.contentFile)
    if (existsSync(frCanonical)) {
      return readFileSync(frCanonical, "utf8")
    }
  }

  return null
}

async function main() {
  let documentCount = 0
  let versionCount = 0

  for (const doc of DOCS) {
    const legalDoc = await prisma.legalDocument.upsert({
      where: { slug: doc.slug },
      update: {
        type: doc.type as LegalDocumentType,
        title: doc.title,
        category: doc.category,
        requiresAccept: doc.requiresAccept,
      },
      create: {
        type: doc.type as LegalDocumentType,
        title: doc.title,
        slug: doc.slug,
        category: doc.category,
        requiresAccept: doc.requiresAccept,
      },
    })
    documentCount += 1

    let frVersionId: string | null = null

    for (const locale of LOCALES) {
      const content = loadContent(doc, locale)
      if (!content) continue

      const contentHash = createHash("sha256").update(content).digest("hex")

      const version = await prisma.legalVersion.upsert({
        where: {
          documentId_version_language: {
            documentId: legalDoc.id,
            version: "1.0.0",
            language: locale,
          },
        },
        update: { content, contentHash, title: doc.title },
        create: {
          documentId: legalDoc.id,
          version: "1.0.0",
          language: locale,
          title: doc.title,
          content,
          contentHash,
          publishedBy: "system:seed",
          changelog: "Initial import from legal/content/",
        },
      })
      versionCount += 1

      if (locale === "fr") {
        frVersionId = version.id
      }
    }

    if (frVersionId) {
      await prisma.legalDocument.update({
        where: { id: legalDoc.id },
        data: { currentVersionId: frVersionId },
      })
    }
  }

  console.log(`[legal:seed] Created ${documentCount} documents, ${versionCount} versions`)

  await prisma.legalPolicy.upsert({
    where: { key: "LEGAL_GATE_V2_ENABLED" },
    update: {},
    create: { key: "LEGAL_GATE_V2_ENABLED", enabled: false },
  })
  console.log("[legal:seed] LegalPolicy LEGAL_GATE_V2_ENABLED seeded (disabled)")
}

main()
  .catch((err) => {
    console.error("[legal:seed]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
