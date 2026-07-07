/** Client-safe SEO browse path helpers (no Prisma). */

export function categoryBrowsePath(slug: string): string {
  const normalized = slug.trim()
  if (!normalized) return "/"
  return `/browse/${encodeURIComponent(normalized)}`
}
