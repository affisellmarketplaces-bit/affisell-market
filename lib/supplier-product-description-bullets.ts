/** Long-form description stays in `Product.description`; bullets power an Amazon-style “About this item” block. */

const MAX_BULLETS = 14
const MAX_LEN = 500

export function parseDescriptionBullets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== "string") continue
    const t = x.trim()
    if (!t) continue
    out.push(t.slice(0, MAX_LEN))
    if (out.length >= MAX_BULLETS) break
  }
  return out
}
