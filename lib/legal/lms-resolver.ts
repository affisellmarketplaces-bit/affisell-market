import "server-only"

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import matter from "gray-matter"
import type { LegalDocument, LegalVersion } from "@prisma/client"

import { isAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { prisma } from "@/lib/prisma"

const SUPPORTED_LMS_SLUGS = [
  "customer",
  "terms-of-sale",
  "supplier",
  "affiliate",
  "privacy",
  "cookies",
  "refunds",
  "legal-notice",
  "affisell-plus",
  "payments",
  "dac7",
  "vat",
] as const

export type LegalLmsSlug = (typeof SUPPORTED_LMS_SLUGS)[number]

export type LegalDocumentApiPayload = {
  meta: {
    slug: string
    version: string
    title: string
    publishedAt: string
    contentHash: string
    locale: string
    category: string
    requiresAccept: boolean
    source: "db" | "legacy"
  }
  content: string
}

const LEGACY_SLUG_BY_LMS: Record<string, string> = {
  customer: "terms-of-service",
  "terms-of-sale": "terms-of-sale",
  supplier: "terms-supplier",
  affiliate: "terms-affiliate",
  privacy: "privacy-policy",
  cookies: "cookies-policy",
  refunds: "refund-policy",
  "legal-notice": "mentions",
  "affisell-plus": "affisell-plus",
}

const DEFAULT_TITLES: Record<string, string> = {
  customer: "Conditions Générales d'Utilisation",
  "terms-of-sale": "Conditions Générales de Vente",
  supplier: "Conditions Fournisseur",
  affiliate: "Conditions Affilié",
  privacy: "Politique de Confidentialité",
  cookies: "Politique Cookies",
  refunds: "Politique Remboursement",
  "legal-notice": "Mentions Légales",
  "affisell-plus": "Affisell Plus",
  payments: "Politique Paiements",
  dac7: "DAC7",
  vat: "TVA",
}

export function mapLegacySlug(slug: string): string | null {
  return LEGACY_SLUG_BY_LMS[slug] ?? null
}

export function isLegalLmsSlug(slug: string): slug is LegalLmsSlug {
  return (SUPPORTED_LMS_SLUGS as readonly string[]).includes(slug)
}

export async function getLegalDocument(slug: string): Promise<LegalDocument | null> {
  return prisma.legalDocument.findUnique({
    where: { slug },
  })
}

export async function getCurrentVersion(
  slug: string,
  locale: string
): Promise<(LegalVersion & { document: LegalDocument }) | null> {
  const document = await prisma.legalDocument.findUnique({
    where: { slug },
    include: { currentVersion: true },
  })

  if (!document?.currentVersion) return null

  const canonical = document.currentVersion
  const resolvedLocale = isAppLocale(locale) ? locale : null
  if (!resolvedLocale) return null

  if (canonical.language === resolvedLocale) {
    return { ...canonical, document }
  }

  const localized = await prisma.legalVersion.findUnique({
    where: {
      documentId_version_language: {
        documentId: document.id,
        version: canonical.version,
        language: resolvedLocale,
      },
    },
  })

  if (localized) {
    return { ...localized, document }
  }

  return { ...canonical, document }
}

function legacyContentPath(locale: AppLocale, legacySlug: string): string {
  return path.join(process.cwd(), "legal", "content", locale, `${legacySlug}.md`)
}

function readLegacyLegalFile(
  slug: string,
  locale: string
): LegalDocumentApiPayload | null {
  const legacySlug = mapLegacySlug(slug)
  if (!legacySlug || !isAppLocale(locale)) return null

  const candidates: AppLocale[] = [locale]
  if (locale !== "fr") candidates.push("fr")
  if (!candidates.includes("en")) candidates.push("en")

  for (const loc of candidates) {
    const filePath = legacyContentPath(loc, legacySlug)
    if (!existsSync(filePath)) continue

    const raw = readFileSync(filePath, "utf8")
    const { data, content } = matter(raw)
    const body = content.trim()
    const title =
      typeof data.title === "string" ? data.title : (DEFAULT_TITLES[slug] ?? slug)
    const publishedAt =
      typeof data.lastUpdated === "string"
        ? data.lastUpdated
        : new Date().toISOString().slice(0, 10)

    return {
      meta: {
        slug,
        version: "legacy",
        title,
        publishedAt,
        contentHash: createHash("sha256").update(body).digest("hex"),
        locale: loc,
        category: slug === "customer" || slug === "terms-of-sale" || slug === "supplier" || slug === "affiliate"
          ? "agreement"
          : "policy",
        requiresAccept:
          slug === "customer" ||
          slug === "terms-of-sale" ||
          slug === "supplier" ||
          slug === "affiliate" ||
          slug === "privacy",
        source: "legacy",
      },
      content: body,
    }
  }

  return null
}

function toApiPayload(
  slug: string,
  version: LegalVersion & { document: LegalDocument },
  locale: string
): LegalDocumentApiPayload {
  return {
    meta: {
      slug,
      version: version.version,
      title: version.title,
      publishedAt: version.publishedAt.toISOString(),
      contentHash: version.contentHash,
      locale,
      category: version.document.category,
      requiresAccept: version.document.requiresAccept,
      source: "db",
    },
    content: version.content,
  }
}

export async function resolveLegalDocumentApi(
  slug: string,
  locale: string
): Promise<LegalDocumentApiPayload | null> {
  const version = await getCurrentVersion(slug, locale)
  if (version) {
    console.log("[legal-api]", {
      slug,
      locale,
      source: "db",
      version: version.version,
      result: "ok",
    })
    return toApiPayload(slug, version, locale)
  }

  const legacy = readLegacyLegalFile(slug, locale)
  if (legacy) {
    console.log("[legal-api]", {
      slug,
      locale,
      source: "legacy",
      version: legacy.meta.version,
      result: "ok",
    })
    return legacy
  }

  console.log("[legal-api]", { slug, locale, result: "not_found" })
  return null
}

export function cacheControlForLegalDocument(meta: LegalDocumentApiPayload["meta"]): string {
  if (meta.category === "agreement" && meta.requiresAccept) {
    return "no-store"
  }
  return "public, max-age=300, stale-while-revalidate=60"
}
