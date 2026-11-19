/**
 * Stable key for cart merge / DB unique (order: color, size, then storage). The storage part (`g:`) is written only
 * when the buyer chose a capacity AND a size (a product with both); with no size the capacity travels in the size slot,
 * as it always has, so existing signatures and cart rows keep their exact value.
 */
export function normalizeCartVariantSignature(
  color?: string | null,
  size?: string | null,
  storage?: string | null
): string {
  const c = typeof color === "string" ? color.trim().slice(0, 48) : ""
  const s = typeof size === "string" ? size.trim().slice(0, 40) : ""
  const g = typeof storage === "string" ? storage.trim().slice(0, 40) : ""
  if (!c && !s && !g) return ""
  const parts: string[] = []
  if (c) parts.push(`c:${c}`)
  if (s) parts.push(`s:${s}`)
  if (g && s && g.toLowerCase() !== s.toLowerCase()) parts.push(`g:${g}`)
  else if (g && !s) parts.push(`s:${g}`)
  return parts.join("|")
}

export function parseCartVariantSignature(sig: string): { color?: string; size?: string; storage?: string } {
  const out: { color?: string; size?: string; storage?: string } = {}
  if (!sig?.trim()) return out
  for (const part of sig.split("|")) {
    if (part.startsWith("c:")) out.color = part.slice(2).trim() || undefined
    if (part.startsWith("s:")) out.size = part.slice(2).trim() || undefined
    if (part.startsWith("g:")) out.storage = part.slice(2).trim() || undefined
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
