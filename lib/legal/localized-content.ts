import "server-only"

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import matter from "gray-matter"

import { applyLegalPlaceholders } from "@/lib/legal/entity"
import { slugifyHeading } from "@/lib/legal/slugify-heading"
import type { LegalDocMeta } from "@/lib/legal/types"
import { LEGAL_SLUGS, type LegalSlug } from "@/lib/legal/types"
import { resolveAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"

/** Buyer-facing terms of sale — `/cgv` (not in legacy `LEGAL_SLUGS`). */
export const TERMS_OF_SALE_SLUG = "terms-of-sale" as const

export type LocalizedLegalSlug = LegalSlug | typeof TERMS_OF_SALE_SLUG

export const LOCALIZED_LEGAL_SLUGS: readonly LocalizedLegalSlug[] = [
  TERMS_OF_SALE_SLUG,
  ...LEGAL_SLUGS,
]

export function isLocalizedLegalSlug(slug: string): slug is LocalizedLegalSlug {
  return (LOCALIZED_LEGAL_SLUGS as readonly string[]).includes(slug)
}

const LOCALE_FALLBACK_CHAIN: AppLocale[] = ["en", "fr"]

const LEGAL_CONTENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../legal/content"
)

function resolveLegalContentDir(): string {
  if (fs.existsSync(LEGAL_CONTENT_DIR)) return LEGAL_CONTENT_DIR
  const standaloneDir = path.resolve(LEGAL_CONTENT_DIR, "../../.next/standalone/legal/content")
  if (fs.existsSync(standaloneDir)) return standaloneDir
  return LEGAL_CONTENT_DIR
}

function localeCandidates(locale: AppLocale): AppLocale[] {
  const chain = [locale, ...LOCALE_FALLBACK_CHAIN.filter((l) => l !== locale)]
  return [...new Set(chain)]
}

function readLocalizedFile(slug: LocalizedLegalSlug, locale: AppLocale): string | null {
  const base = resolveLegalContentDir()
  for (const loc of localeCandidates(locale)) {
    const filePath = path.join(base, loc, `${slug}.md`)
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8")
    }
  }
  return null
}

export type LocalizedLegalDocument = {
  meta: LegalDocMeta
  content: string
  headings: { id: string; text: string; level: number }[]
  locale: AppLocale
}

function extractHeadings(md: string): { id: string; text: string; level: number }[] {
  const out: { id: string; text: string; level: number }[] = []
  for (const line of md.split("\n")) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    if (!m) continue
    const level = m[1]!.length
    const text = m[2]!.replace(/\*\*/g, "").trim()
    out.push({ id: slugifyHeading(text), text, level })
  }
  return out
}

export function loadLocalizedLegalDocument(
  slug: LocalizedLegalSlug,
  locale: AppLocale
): LocalizedLegalDocument {
  const raw = readLocalizedFile(slug, locale)
  if (!raw) {
    throw new Error(`Localized legal document not found: ${slug} (${locale})`)
  }

  const { data, content } = matter(raw)
  const lastUpdated =
    typeof data.lastUpdated === "string"
      ? data.lastUpdated
      : new Date().toISOString().slice(0, 10)

  const processed = applyLegalPlaceholders(content.trim(), lastUpdated)
  const resolvedLocale = localeCandidates(locale).find((loc) =>
    fs.existsSync(path.join(resolveLegalContentDir(), loc, `${slug}.md`))
  )

  return {
    meta: {
      slug,
      title: String(data.title ?? slug),
      description: String(data.description ?? ""),
      lastUpdated,
      order: Number(data.order ?? 99),
    },
    content: processed,
    headings: extractHeadings(processed),
    locale: resolvedLocale ?? locale,
  }
}

export async function loadLocalizedLegalDocumentForRequest(
  slug: LocalizedLegalSlug
): Promise<LocalizedLegalDocument> {
  const locale = await resolveRequestLocale(undefined)
  return loadLocalizedLegalDocument(slug, resolveAppLocale(locale))
}

export function listLocalizedLegalDocuments(locale: AppLocale): LegalDocMeta[] {
  return LOCALIZED_LEGAL_SLUGS.map((slug) => loadLocalizedLegalDocument(slug, locale).meta).sort(
    (a, b) => a.order - b.order
  )
}
