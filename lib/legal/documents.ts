import "server-only"

import fs from "node:fs"
import path from "node:path"

import matter from "gray-matter"

import { applyLegalPlaceholders } from "@/lib/legal/entity"
import { slugifyHeading } from "@/lib/legal/slugify-heading"
import type { LegalDocMeta, LegalSlug } from "@/lib/legal/types"
import { LEGAL_SLUGS, isLegalSlug } from "@/lib/legal/types"

export type { LegalDocMeta, LegalSlug }
export { LEGAL_SLUGS, isLegalSlug, slugifyHeading }

function resolveLegalDir(): string {
  const candidates = [
    path.join(process.cwd(), "legal"),
    path.join(process.cwd(), ".next/standalone/legal"),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir
  }
  return candidates[0]!
}

export function loadLegalDocument(slug: LegalSlug): {
  meta: LegalDocMeta
  content: string
  headings: { id: string; text: string; level: number }[]
} {
  const filePath = path.join(resolveLegalDir(), `${slug}.md`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Legal document not found: ${slug} (${filePath})`)
  }
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
