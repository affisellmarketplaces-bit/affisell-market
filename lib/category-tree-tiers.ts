/** Split root categories into up to three balanced tiers for tri-dash sidebar layout. */
export function chunkCategoryRoots<T>(items: T[]): T[][] {
  if (items.length <= 1) return items.length ? [items] : []
  const tierSize = Math.ceil(items.length / 3)
  return [items.slice(0, tierSize), items.slice(tierSize, tierSize * 2), items.slice(tierSize * 2)].filter(
    (tier) => tier.length > 0
  )
}
