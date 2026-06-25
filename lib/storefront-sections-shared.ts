/** Homepage section config — safe for `"use client"` (no Prisma). */

export const HOMEPAGE_SECTION_TYPES = ["hero", "story", "products", "trust", "cta"] as const
export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPES)[number]

export type HomepageSection = {
  type: HomepageSectionType
  enabled: boolean
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSection[] = [
  { type: "hero", enabled: true },
  { type: "story", enabled: true },
  { type: "products", enabled: true },
  { type: "trust", enabled: true },
  { type: "cta", enabled: false },
]

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

export function homepageSectionsEqual(a: HomepageSection[], b: HomepageSection[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s, i) => s.type === b[i]?.type && s.enabled === b[i]?.enabled)
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
