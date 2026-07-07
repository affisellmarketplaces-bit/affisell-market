/** Client-safe SEO browse path helpers (no Prisma). */

/** Top-N categories pre-rendered at build time (ISR for the rest). */
export const BROWSE_STATIC_PARAMS_LIMIT = 48

export function categoryBrowsePath(slug: string): string {
  const normalized = slug.trim()
  if (!normalized) return "/"
  return `/browse/${encodeURIComponent(normalized)}`
}
