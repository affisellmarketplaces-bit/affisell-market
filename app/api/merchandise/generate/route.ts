import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import OpenAI from "openai"
import PQueue from "p-queue"

import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { generateCategoryCard } from "@/lib/merchandise/generate-card"
import { resolveMerchandisingDepartment } from "@/lib/merchandise/templates"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

async function descendantCategoryIds(rootId: string): Promise<string[]> {
  const ids = new Set<string>([rootId])
  let frontier: string[] = [rootId]
  while (frontier.length) {
    const next = await prisma.category.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    })
    frontier = []
    for (const row of next) {
      if (!ids.has(row.id)) {
        ids.add(row.id)
        frontier.push(row.id)
      }
    }
  }
  return [...ids]
}

/** `Product` has no `viewsLast7d` column — approximate with `AffisellTrackEvent` views in the last 7 days. */
async function productViewCountsLast7d(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!productIds.length) return map

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const rows = await prisma.affisellTrackEvent.groupBy({
    by: ["productId"],
    where: {
      eventType: "view",
      createdAt: { gte: since },
      productId: { in: productIds },
    },
    _count: { _all: true },
  })

  for (const row of rows) {
    if (row.productId) map.set(row.productId, row._count._all)
  }
  return map
}

function scoreProduct(views: number, basePriceCents: number): number {
  return views * basePriceCents
}

export async function GET(request: NextRequest) {
  const categoryParam = request.nextUrl.searchParams.get("category")?.trim() ?? ""
  const resolved = resolveMerchandisingDepartment(categoryParam)
  if (!resolved) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 })
  }

  const root = await prisma.category.findFirst({
    where: { name: resolved.dbRootName, parentId: null },
    select: { id: true, name: true },
  })
  if (!root) {
    return NextResponse.json({ error: "Category not seeded in database" }, { status: 404 })
  }

  const catIds = await descendantCategoryIds(root.id)

  const pool = await prisma.product.findMany({
    where: {
      categoryId: { in: catIds },
      stock: { gt: 0 },
      active: true,
      isDraft: false,
      images: { isEmpty: false },
    },
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
      categoryId: true,
      categories: true,
      category: { select: { id: true, name: true, parentId: true } },
      affiliateProducts: {
        where: {
          isListed: true,
          ...affiliateRoleMarketplaceWhere,
        },
        take: 1,
        orderBy: [{ clicks: "desc" }, { updatedAt: "desc" }],
        select: { id: true },
      },
    },
    take: 80,
  })

  const withListing = pool.filter((p) => p.affiliateProducts.length > 0)
  const ids = withListing.map((p) => p.id)
  const viewsMap = await productViewCountsLast7d(ids)

  const sorted = [...withListing].sort((a, b) => {
    const sa = scoreProduct(viewsMap.get(a.id) ?? 0, a.basePriceCents)
    const sb = scoreProduct(viewsMap.get(b.id) ?? 0, b.basePriceCents)
    return sb - sa
  })

  const top = sorted.slice(0, 4)
  const template = resolved.template

  const queue = new PQueue({ concurrency: 1 })
  await Promise.all(
    top.map((p) =>
      queue.add(async () => {
        const label =
          p.category?.name && p.category.id !== root.id
            ? p.category.name
            : (p.categories[0] ?? p.category?.name ?? p.name.slice(0, 32))
        await generateCategoryCard({ id: p.id, images: p.images }, label, template)
      })
    )
  )

  const titles = top.map((p) => p.name)
  let title = `Top picks in ${root.name}`
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey && titles.length) {
    try {
      const openai = new OpenAI({ apiKey })
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 32,
        messages: [
          {
            role: "system",
            content:
              "You write ultra-short English merchandising headlines like Amazon homepage blocks. Maximum 4 words. No quotation marks. No trailing punctuation.",
          },
          {
            role: "user",
            content: `Catchy headline, 4 words max, for these product titles: ${titles.join(" | ")}. Amazon style.`,
          },
        ],
      })
      const t = completion.choices[0]?.message?.content?.trim()
      if (t) title = t.replace(/^["']|["']$/g, "").slice(0, 80)
    } catch {
      /* keep fallback */
    }
  }

  const items = top.map((p) => {
    const listingId = p.affiliateProducts[0]?.id
    const label =
      p.category?.name && p.category.id !== root.id
        ? p.category.name
        : (p.categories[0] ?? p.category?.name ?? p.name.slice(0, 40))
    return {
      image: `/generated/categories/${p.id}.png`,
      label,
      href: listingId
        ? `/marketplace/${encodeURIComponent(listingId)}`
        : `/marketplace?category=${encodeURIComponent(root.id)}`,
    }
  })

  return NextResponse.json({
    title,
    categoryId: root.id,
    items,
  })
}
