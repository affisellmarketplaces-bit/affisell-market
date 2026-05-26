import fs from "node:fs"
import path from "node:path"

import matter from "gray-matter"

import { applyLegalPlaceholders } from "@/lib/legal/entity"

export type LegalDocMeta = {
  slug: string
  title: string
  description: string
  lastUpdated: string
  order: number
}

export const LEGAL_SLUGS = [
  "terms-of-service",
  "terms-supplier",
  "terms-affiliate",
  "privacy-policy",
  "refund-policy",
  "cookies-policy",
  "mentions",
] as const

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

const LEGAL_DIR = path.join(process.cwd(), "legal")

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug)
}

export function loadLegalDocument(slug: LegalSlug): {
  meta: LegalDocMeta
  content: string
  headings: { id: string; text: string; level: number }[]
} {
  const filePath = path.join(LEGAL_DIR, `${slug}.md`)
  const raw = fs.readFileSync(filePath, "utf8")
  const { data, content } = matter(raw)
  const lastUpdated =
    typeof data.lastUpdated === "string"
      ? data.lastUpdated
      : new Date().toISOString().slice(0, 10)

  const processed = applyLegalPlaceholders(content.trim(), lastUpdated)
  const headings = extractHeadings(processed)

  return {
    meta: {
      slug,
      title: String(data.title ?? slug),
      description: String(data.description ?? ""),
      lastUpdated,
      order: Number(data.order ?? 99),
    },
    content: processed,
    headings,
  }
}

export function listLegalDocuments(): LegalDocMeta[] {
  return LEGAL_SLUGS.map((slug) => loadLegalDocument(slug).meta).sort((a, b) => a.order - b.order)
}

function extractHeadings(md: string): { id: string; text: string; level: number }[] {
  const out: { id: string; text: string; level: number }[] = []
  for (const line of md.split("\n")) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    if (!m) continue
    const level = m[1]!.length
    const text = m[2]!.replace(/\*\*/g, "").trim()
    const id = slugifyHeading(text)
    out.push({ id, text, level })
  }
  return out
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
