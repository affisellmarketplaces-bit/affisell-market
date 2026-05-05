import type { Prisma, PrismaClient } from "@prisma/client"

import type { AgentProductCard } from "@/lib/agent-product-card-types"
import { primaryProductImage } from "@/lib/product-images"

export type AgentHistoryContext = {
  userId: string | null
  sessionId: string | null
}

function historyWhere(ctx: AgentHistoryContext): Prisma.SearchHistoryWhereInput | null {
  if (ctx.userId) return { userId: ctx.userId }
  if (ctx.sessionId) return { sessionId: ctx.sessionId }
  return null
}

export async function recordAgentSearch(
  db: PrismaClient,
  ctx: AgentHistoryContext,
  query: string,
  firstProductId: string | null
): Promise<void> {
  // Persist history only for authenticated users with a valid user row.
  if (!ctx.userId) return
  const q = query.trim().slice(0, 500)
  if (!q) return

  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true },
  })
  if (!user) return

  await db.searchHistory.create({
    data: {
      userId: user.id,
      sessionId: null,
      query: q,
      productId: firstProductId ?? null,
    },
  })
}

export type AgentHistoryApiResponse = {
  recentQueries: string[]
  lastQuery: string | null
  viewedProducts: AgentProductCard[]
}

async function productIdsToCards(db: PrismaClient, productIds: string[]): Promise<AgentProductCard[]> {
  const unique = [...new Set(productIds)].filter(Boolean)
  if (unique.length === 0) return []

  const products = await db.product.findMany({
    where: { id: { in: unique }, active: true },
    select: {
      id: true,
      name: true,
      description: true,
      basePriceCents: true,
      images: true,
      supplier: { select: { name: true, store: { select: { name: true } } } },
    },
  })

  const listings = await db.affiliateProduct.findMany({
    where: { productId: { in: unique }, isListed: true, product: { active: true } },
    select: {
      productId: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
    },
    orderBy: { id: "asc" },
  })
  const firstListing = new Map<string, (typeof listings)[0]>()
  for (const l of listings) {
    if (!firstListing.has(l.productId)) firstListing.set(l.productId, l)
  }

  const brand = (s: { name: string | null; store: { name: string } | null }) =>
    s.store?.name?.trim() || s.name?.trim() || "Affisell"

  const byId = new Map(products.map((p) => [p.id, p]))

  return unique
    .map((id) => {
      const p = byId.get(id)
      if (!p) return null
      const l = firstListing.get(id)
      const imageUrl =
        primaryProductImage(l?.customImages as string[] | undefined) || primaryProductImage(p.images) || null
      const name = l?.customTitle?.trim() || p.name
      const price = l ? l.sellingPriceCents / 100 : p.basePriceCents / 100
      const description =
        p.description.length > 400 ? `${p.description.slice(0, 397)}…` : p.description
      return {
        id: p.id,
        name,
        price,
        imageUrl,
        description,
        brand: brand(p.supplier),
      } satisfies AgentProductCard
    })
    .filter((x): x is AgentProductCard => x != null)
}

export async function buildAgentHistoryResponse(
  db: PrismaClient,
  ctx: AgentHistoryContext
): Promise<AgentHistoryApiResponse> {
  const where = historyWhere(ctx)
  if (!where) {
    return { recentQueries: [], lastQuery: null, viewedProducts: [] }
  }

  const rows = await db.searchHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { query: true, productId: true, createdAt: true },
  })

  const lastQuery = rows[0]?.query?.trim() || null

  const seenQ = new Set<string>()
  const recentQueries: string[] = []
  for (const r of rows) {
    const q = r.query.trim()
    if (!q || seenQ.has(q)) continue
    seenQ.add(q)
    recentQueries.push(q)
    if (recentQueries.length >= 5) break
  }

  const viewedIds: string[] = []
  const seenPid = new Set<string>()
  for (const r of rows) {
    const pid = r.productId
    if (!pid || seenPid.has(pid)) continue
    seenPid.add(pid)
    viewedIds.push(pid)
    if (viewedIds.length >= 12) break
  }

  const viewedProducts = await productIdsToCards(db, viewedIds)

  return { recentQueries, lastQuery, viewedProducts }
}

export async function getAgentHistoryForTools(
  db: PrismaClient,
  ctx: AgentHistoryContext
): Promise<AgentHistoryApiResponse> {
  const full = await buildAgentHistoryResponse(db, ctx)
  return {
    ...full,
    viewedProducts: full.viewedProducts.slice(0, 5),
  }
}
