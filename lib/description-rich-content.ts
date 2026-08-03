/** Inline image markers in supplier long description — `[[img:N]]` indexes `descriptionIllustrationImages`. */

/** ASCII + fullwidth brackets; optional spaces around tokens. */
export const DESCRIPTION_IMG_MARKER_RE =
  /[\[\uFF3B]{2}\s*img\s*:\s*(\d+)\s*[\]\uFF3D]{2}/gi

export type DescriptionContentPart =
  | { kind: "text"; text: string }
  | { kind: "image"; index: number; src: string | null }

/** Normalize invisible / lookalike chars so markers always parse. */
export function normalizeDescriptionMarkerNoise(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/\uFF3B/g, "[")
    .replace(/\uFF3D/g, "]")
}

const MARKER_MATCH_RE = /\[\[\s*img\s*:\s*(\d+)\s*\]\]/gi
const MARKER_TEST_RE = /\[\[\s*img\s*:\s*\d+\s*\]\]/i

export function descriptionHasImageMarkers(text: string): boolean {
  return MARKER_TEST_RE.test(normalizeDescriptionMarkerNoise(text))
}

/** Strip all [[img:N]] markers (and leftover blank lines) for plain-text UIs / form fields. */
export function stripDescriptionImageMarkers(text: string): string {
  return normalizeDescriptionMarkerNoise(text)
    .replace(/\[\[\s*img\s*:\s*\d+\s*\]\]/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Remove lines that contain only `[[img:N]]` — editor hygiene (images live in the gallery strip). */
export function stripStandaloneImageMarkerLines(text: string): string {
  const lines = normalizeDescriptionMarkerNoise(text).split("\n")
  const filtered = lines.filter((line) => !/^\s*\[\[\s*img\s*:\s*\d+\s*\]\]\s*$/i.test(line))
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()
}

export function parseDescriptionRichContent(text: string, images: string[]): DescriptionContentPart[] {
  const raw = normalizeDescriptionMarkerNoise(text)
  if (!raw.trim()) return []

  const parts: DescriptionContentPart[] = []
  const re = new RegExp(MARKER_MATCH_RE.source, "gi")
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", text: raw.slice(lastIndex, match.index) })
    }
    const index = Number.parseInt(match[1]!, 10)
    parts.push({
      kind: "image",
      index,
      src: Number.isFinite(index) ? (images[index] ?? null) : null,
    })
    lastIndex = re.lastIndex
  }

  if (lastIndex < raw.length) {
    parts.push({ kind: "text", text: raw.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ kind: "text", text: raw }]
}

export function referencedIllustrationIndexes(text: string): Set<number> {
  const used = new Set<number>()
  const re = new RegExp(MARKER_MATCH_RE.source, "gi")
  let match: RegExpExecArray | null
  const raw = normalizeDescriptionMarkerNoise(text)
  while ((match = re.exec(raw)) !== null) {
    const index = Number.parseInt(match[1]!, 10)
    if (Number.isFinite(index) && index >= 0) used.add(index)
  }
  return used
}

export function unreferencedIllustrationImages(text: string, images: string[]): string[] {
  const used = referencedIllustrationIndexes(text)
  return images.filter((_, i) => !used.has(i))
}

/** After removing image at `removedIndex`, drop its marker and shift higher indexes down. */
export function reindexDescriptionAfterImageRemoval(description: string, removedIndex: number): string {
  let next = normalizeDescriptionMarkerNoise(description).replace(
    new RegExp(`\\[\\[\\s*img\\s*:\\s*${removedIndex}\\s*\\]\\]\\n?`, "gi"),
    ""
  )
  next = next.replace(/\[\[\s*img\s*:\s*(\d+)\s*\]\]/gi, (_, raw: string) => {
    const index = Number.parseInt(raw, 10)
    if (!Number.isFinite(index)) return `[[img:${raw}]]`
    if (index > removedIndex) return `[[img:${index - 1}]]`
    return `[[img:${index}]]`
  })
  return next
}

export function insertImageMarkerAt(description: string, index: number, cursor: number): string {
  const marker = `[[img:${index}]]\n`
  const safeCursor = Math.max(0, Math.min(cursor, description.length))
  return description.slice(0, safeCursor) + marker + description.slice(safeCursor)
}
