/** Marketplace facet shapes for API + client filters (no Prisma). */

export type MarketplaceFacetValue = { value: string; count: number }
export type MarketplaceFacet = { key: string; label: string; values: MarketplaceFacetValue[] }
