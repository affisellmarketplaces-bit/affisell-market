import { prisma } from "@/lib/prisma"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MS_DAY = 24 * 60 * 60 * 1000

type CatRow = { category: string; total: bigint }

function formatEurCents(cents: number): string {
  return formatStoreCurrencyFromCents(cents, { maximumFractionDigits: 0 })
}

export async function GET() {
  const now = Date.now()
  const currentStart = new Date(now - 30 * MS_DAY)
  const currentEnd = new Date(now)
  const prevStart = new Date(now - 60 * MS_DAY)
  const prevEnd = new Date(now - 30 * MS_DAY)

  const [currentRows, prevRows] = await Promise.all([
    prisma.$queryRaw<CatRow[]>`
      SELECT sub.cat AS category, SUM(sub.amount)::bigint AS total
      FROM (
        SELECT unnest(p.categories) AS cat, o."sellingPriceCents" AS amount
        FROM "Order" o
        INNER JOIN "Product" p ON p.id = o."productId"
        WHERE o."createdAt" >= ${currentStart}
          AND o."createdAt" < ${currentEnd}
          AND cardinality(p.categories) > 0
          AND p.active = true
      ) sub
      GROUP BY sub.cat
    `,
    prisma.$queryRaw<CatRow[]>`
      SELECT sub.cat AS category, SUM(sub.amount)::bigint AS total
      FROM (
        SELECT unnest(p.categories) AS cat, o."sellingPriceCents" AS amount
        FROM "Order" o
        INNER JOIN "Product" p ON p.id = o."productId"
        WHERE o."createdAt" >= ${prevStart}
          AND o."createdAt" < ${prevEnd}
          AND cardinality(p.categories) > 0
          AND p.active = true
      ) sub
      GROUP BY sub.cat
    `,
  ])

  const curMap = new Map(currentRows.map((r) => [r.category, Number(r.total)]))
  const prevMap = new Map(prevRows.map((r) => [r.category, Number(r.total)]))

  const marketTotalCents = [...curMap.values()].reduce((s, v) => s + v, 0) || 1
  const topCategories = [...curMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const categories = topCategories.map(([name, totalCents]) => {
    const prev = prevMap.get(name) ?? 0
    let growthPct: number | null = null
    if (prev > 0) {
      growthPct = Math.round(((totalCents - prev) / prev) * 1000) / 10
    } else if (totalCents > 0) {
      growthPct = null
    }
    return {
      category: name,
      totalCents,
      pctOfTop: Math.round((totalCents / marketTotalCents) * 1000) / 10,
      growthPct,
      isNew: prev === 0 && totalCents > 0,
      totalLabel: formatEurCents(totalCents),
    }
  })

  const chartData = categories.map((c) => ({
    name: c.category.length > 14 ? `${c.category.slice(0, 12)}…` : c.category,
    sales: c.totalCents / 100,
  }))

  return Response.json({ categories, chartData })
}
