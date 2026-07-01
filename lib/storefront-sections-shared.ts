/** Homepage section config — safe for `"use client"` (no Prisma). */

export const HOMEPAGE_SECTION_TYPES = [
  "hero",
  "story",
  "bestsellers",
  "products",
  "social-proof",
  "trust",
  "newsletter",
  "cta",
] as const
export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPES)[number]

export type HomepageSectionContent = {
  eyebrow?: string
  title?: string
  body?: string
  buttonLabel?: string
  buttonHref?: string
  placeholder?: string
  quote?: string
  author?: string
  stat?: string
  productLimit?: number
}

export type HomepageSection = {
  type: HomepageSectionType
  enabled: boolean
  content?: HomepageSectionContent
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSection[] = [
  { type: "hero", enabled: true },
  { type: "story", enabled: true },
  { type: "bestsellers", enabled: false },
  { type: "products", enabled: true },
  { type: "social-proof", enabled: false },
  { type: "trust", enabled: true },
  { type: "newsletter", enabled: false },
  { type: "cta", enabled: false },
]

const CONTENT_STRING_LIMIT = 280
const CONTENT_HREF_LIMIT = 200

function parseContentString(raw: unknown, max = CONTENT_STRING_LIMIT): string | undefined {
  if (typeof raw !== "string") return undefined
  const v = raw.trim()
  return v ? v.slice(0, max) : undefined
}

export function parseHomepageSectionContent(raw: unknown): HomepageSectionContent | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const content: HomepageSectionContent = {}

  const eyebrow = parseContentString(o.eyebrow, 80)
  const title = parseContentString(o.title)
  const body = parseContentString(o.body, 600)
  const buttonLabel = parseContentString(o.buttonLabel, 60)
  const buttonHref = parseContentString(o.buttonHref, CONTENT_HREF_LIMIT)
  const placeholder = parseContentString(o.placeholder, 80)
  const quote = parseContentString(o.quote, 400)
  const author = parseContentString(o.author, 80)
  const stat = parseContentString(o.stat, 80)

  if (eyebrow) content.eyebrow = eyebrow
  if (title) content.title = title
  if (body) content.body = body
  if (buttonLabel) content.buttonLabel = buttonLabel
  if (buttonHref) content.buttonHref = buttonHref
  if (placeholder) content.placeholder = placeholder
  if (quote) content.quote = quote
  if (author) content.author = author
  if (stat) content.stat = stat

  if (typeof o.productLimit === "number" && Number.isFinite(o.productLimit)) {
    content.productLimit = Math.min(8, Math.max(4, Math.round(o.productLimit)))
  }

  return Object.keys(content).length > 0 ? content : undefined
}

export function sectionCopyString(
  content: HomepageSectionContent | undefined,
  field: Exclude<keyof HomepageSectionContent, "productLimit">,
  fallback: string
): string {
  const v = content?.[field]
  return typeof v === "string" && v.trim() ? v.trim() : fallback
}

export function sectionProductLimit(content: HomepageSectionContent | undefined): number {
  const n = content?.productLimit
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.min(8, Math.max(4, Math.round(n)))
  }
  return 4
}

export function parseHomepageSectionType(raw: unknown): HomepageSectionType | null {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase() as HomepageSectionType
  return (HOMEPAGE_SECTION_TYPES as readonly string[]).includes(v) ? v : null
}

export function parseHomepageSections(raw: unknown): HomepageSection[] {
  if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE_SECTIONS.map((s) => ({ ...s }))

  const seen = new Set<HomepageSectionType>()
  const parsed: HomepageSection[] = []

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const type = parseHomepageSectionType(o.type)
    if (!type || seen.has(type)) continue
    seen.add(type)
    parsed.push({
      type,
      enabled: o.enabled !== false,
      content: parseHomepageSectionContent(o.content),
    })
  }

  for (const def of DEFAULT_HOMEPAGE_SECTIONS) {
    if (!seen.has(def.type)) {
      parsed.push({ ...def })
    }
  }

  return parsed
}

export function getEnabledHomepageSections(sections: HomepageSection[]): HomepageSection[] {
  return sections.filter((s) => s.enabled)
}

export function isHomepageSectionEnabled(
  sections: HomepageSection[],
  type: HomepageSectionType
): boolean {
  return sections.some((s) => s.type === type && s.enabled)
}

function sectionContentEqual(
  a: HomepageSectionContent | undefined,
  b: HomepageSectionContent | undefined
): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})
}

export function homepageSectionsEqual(a: HomepageSection[], b: HomepageSection[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (s, i) =>
      s.type === b[i]?.type &&
      s.enabled === b[i]?.enabled &&
      sectionContentEqual(s.content, b[i]?.content)
  )
}

export function moveHomepageSection(
  sections: HomepageSection[],
  index: number,
  direction: "up" | "down"
): HomepageSection[] {
  const next = [...sections]
  const target = direction === "up" ? index - 1 : index + 1
  if (target < 0 || target >= next.length) return sections
  const current = next[index]
  const swap = next[target]
  if (!current || !swap) return sections
  next[index] = swap
  next[target] = current
  return next
}

export function toggleHomepageSection(
  sections: HomepageSection[],
  type: HomepageSectionType,
  enabled: boolean
): HomepageSection[] {
  return sections.map((s) => (s.type === type ? { ...s, enabled } : s))
}

export function updateHomepageSectionContent(
  sections: HomepageSection[],
  type: HomepageSectionType,
  patch: Partial<HomepageSectionContent>
): HomepageSection[] {
  return sections.map((s) => {
    if (s.type !== type) return s
    const merged: HomepageSectionContent = { ...(s.content ?? {}), ...patch }
    for (const key of Object.keys(merged) as (keyof HomepageSectionContent)[]) {
      const val = merged[key]
      if (val === undefined || val === "" || (typeof val === "string" && !val.trim())) {
        delete merged[key]
      }
    }
    return {
      ...s,
      content: Object.keys(merged).length > 0 ? merged : undefined,
    }
  })
}

export function serializeHomepageSections(sections: HomepageSection[]): string {
  return JSON.stringify(sections)
}

export function parseHomepageSectionsFromJson(raw: string): HomepageSection[] {
  try {
    return parseHomepageSections(JSON.parse(raw))
  } catch {
    return DEFAULT_HOMEPAGE_SECTIONS.map((s) => ({ ...s }))
  }
}
