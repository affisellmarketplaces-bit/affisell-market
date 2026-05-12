/** Stable key for cart merge / DB unique (order: color then size). */
export function normalizeCartVariantSignature(
  color?: string | null,
  size?: string | null
): string {
  const c = typeof color === "string" ? color.trim().slice(0, 48) : ""
  const s = typeof size === "string" ? size.trim().slice(0, 40) : ""
  if (!c && !s) return ""
  const parts: string[] = []
  if (c) parts.push(`c:${c}`)
  if (s) parts.push(`s:${s}`)
  return parts.join("|")
}

export function parseCartVariantSignature(sig: string): { color?: string; size?: string } {
  const out: { color?: string; size?: string } = {}
  if (!sig?.trim()) return out
  for (const part of sig.split("|")) {
    if (part.startsWith("c:")) out.color = part.slice(2).trim() || undefined
    if (part.startsWith("s:")) out.size = part.slice(2).trim() || undefined
  }
  return out
}

/** Human-readable chips for cart / Stripe line name. */
export function formatCartVariantChips(color?: string | null, size?: string | null): string[] {
  const chips: string[] = []
  const c = typeof color === "string" ? color.trim() : ""
  const s = typeof size === "string" ? size.trim() : ""
  if (c) chips.push(c)
  if (s) chips.push(s)
  return chips
}

export function formatCartVariantLabel(color?: string | null, size?: string | null): string {
  const chips = formatCartVariantChips(color, size)
  if (chips.length === 0) return ""
  return chips.join(" · ")
}
