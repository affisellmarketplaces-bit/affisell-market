/** Inline image markers in supplier long description — `[[img:0]]` indexes `descriptionIllustrationImages`. */

export const DESCRIPTION_IMG_MARKER_RE = /\[\[img:(\d+)\]\]/g

export type DescriptionContentPart =
  | { kind: "text"; text: string }
  | { kind: "image"; index: number; src: string | null }

export function descriptionHasImageMarkers(text: string): boolean {
  return /\[\[img:\d+\]\]/.test(text)
}

export function parseDescriptionRichContent(text: string, images: string[]): DescriptionContentPart[] {
  const raw = text.replace(/\r\n/g, "\n")
  if (!raw.trim()) return []

  const parts: DescriptionContentPart[] = []
  const re = /\[\[img:(\d+)\]\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", text: raw.slice(lastIndex, match.index) })
    }
    const index = Number.parseInt(match[1]!, 10)
    parts.push({ kind: "image", index, src: images[index] ?? null })
    lastIndex = re.lastIndex
  }

  if (lastIndex < raw.length) {
    parts.push({ kind: "text", text: raw.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ kind: "text", text: raw }]
}

export function referencedIllustrationIndexes(text: string): Set<number> {
  const used = new Set<number>()
  const re = /\[\[img:(\d+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
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
  let next = description.replace(new RegExp(`\\[\\[img:${removedIndex}\\]\\]\\n?`, "g"), "")
  next = next.replace(/\[\[img:(\d+)\]\]/g, (_, raw: string) => {
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
