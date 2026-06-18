/** Parse supplier SEO description sections (plain text, no HTML). */

export const DESCRIPTION_SECTION_ORDER = [
  "ACCROCHE",
  "POUR QUI ?",
  "POINTS FORTS",
  "UTILISATION & ENTRETIEN",
  "POURQUOI CE PRODUIT ?",
  "INNOVATION",
] as const

export type DescriptionSectionKey = (typeof DESCRIPTION_SECTION_ORDER)[number]

export type DescriptionSection = {
  key: string
  title: string
  body: string
}

const SECTION_RE = new RegExp(
  `^(${DESCRIPTION_SECTION_ORDER.map((s) => s.replace(/[?&]/g, "\\$&")).join("|")})\\s*$`,
  "im"
)

export function parseDescriptionSections(text: string): DescriptionSection[] {
  const raw = text.replace(/\r\n/g, "\n").trim()
  if (!raw) return []

  const lines = raw.split("\n")
  const sections: DescriptionSection[] = []
  let currentKey: string | null = null
  let currentTitle = ""
  const bodyLines: string[] = []

  const flush = () => {
    if (!currentKey) return
    sections.push({
      key: currentKey,
      title: currentTitle,
      body: bodyLines.join("\n").trim(),
    })
    bodyLines.length = 0
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(SECTION_RE)
    if (match) {
      flush()
      currentKey = match[1]!.toUpperCase()
      currentTitle = trimmed
      continue
    }
    if (currentKey) bodyLines.push(line)
  }
  flush()

  if (sections.length === 0 && raw) {
    return [{ key: "NOTES", title: "Brouillon", body: raw }]
  }
  return sections
}

export type ImagePlacementRole = "hero" | "lifestyle" | "detail" | "scale" | "packaging"

export type DescriptionImagePlacement = {
  section: string
  role: ImagePlacementRole
  caption: string
  imageIndex: number
}

export function normalizeImagePlacements(raw: unknown): DescriptionImagePlacement[] {
  if (!Array.isArray(raw)) return []
  const out: DescriptionImagePlacement[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const section = typeof o.section === "string" ? o.section.trim().slice(0, 80) : ""
    const role = typeof o.role === "string" ? o.role.trim().toLowerCase() : "detail"
    const caption = typeof o.caption === "string" ? o.caption.trim().slice(0, 200) : ""
    const imageIndex = typeof o.imageIndex === "number" ? Math.floor(o.imageIndex) : -1
    if (!section || imageIndex < 0) continue
    const safeRole: ImagePlacementRole =
      role === "hero" || role === "lifestyle" || role === "detail" || role === "scale" || role === "packaging"
        ? role
        : "detail"
    out.push({ section, role: safeRole, caption, imageIndex })
  }
  return out
}

export const IMAGE_ROLE_LABELS: Record<ImagePlacementRole, string> = {
  hero: "Hero — impact",
  lifestyle: "Lifestyle — contexte",
  detail: "Détail — preuve",
  scale: "Échelle — taille",
  packaging: "Packaging — confiance",
}
