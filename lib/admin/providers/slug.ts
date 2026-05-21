export function slugifyProviderName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export async function uniqueProviderSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugifyProviderName(name) || "provider"
  let slug = base
  let n = 0
  while (await exists(slug)) {
    n += 1
    slug = `${base}-${n}`
  }
  return slug
}
