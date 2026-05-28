import { MARKETPLACE_CATEGORY_TAXONOMY_EN } from "@/prisma/marketplace-taxonomy-en"

/** Sidebar fallback when hosted Postgres blocks queries (quota). Slugs only — filters need a live DB. */
export function staticMarketplaceCategories() {
  return MARKETPLACE_CATEGORY_TAXONOMY_EN.map((root, order) => ({
    id: `static:${root.slug}`,
    name: root.name,
    fullPath: root.name,
    icon: root.icon,
    slug: root.slug,
    order,
    count: 0,
    subcategories: root.channels.map((ch) => ({
      id: `static:${root.slug}:${ch.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: ch.name,
      fullPath: `${root.name} > ${ch.name}`,
      slug: ch.name
        .toLowerCase()
        .replace(/'/g, "")
        .replace(/\s*&\s*/g, "-and-")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
      count: 0,
    })),
  }))
}
