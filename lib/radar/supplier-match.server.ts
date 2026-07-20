import "server-only"

import { unstable_cache } from "next/cache"

import { prisma, withPrismaReconnect } from "@/lib/prisma"
import { extractMatchTokens } from "@/lib/radar/supplier-match-shared"

export type SupplierMatchResult = {
  count: number
  sampleNames: string[]
}

export { extractMatchTokens } from "@/lib/radar/supplier-match-shared"

async function countFrSuppliersForTokens(tokens: string[]): Promise<SupplierMatchResult> {
  if (tokens.length === 0) return { count: 0, sampleNames: [] }

  try {
    const rows = await withPrismaReconnect(() =>
      prisma.product.findMany({
        where: {
          active: true,
          isDraft: false,
          AND: [
            {
              OR: [
                { shippingCountry: "FR" },
                { deliveryCountryCodes: { has: "FR" } },
                { shipsFrom: { equals: "FR", mode: "insensitive" } },
              ],
            },
            {
              OR: tokens.flatMap((t) => [
                { name: { contains: t, mode: "insensitive" as const } },
                { description: { contains: t, mode: "insensitive" as const } },
              ]),
            },
          ],
        },
        select: { id: true, name: true, supplierId: true },
        take: 12,
        orderBy: { updatedAt: "desc" },
      })
    )

    const suppliers = new Set(rows.map((r) => r.supplierId).filter(Boolean))
    return {
      count: suppliers.size > 0 ? suppliers.size : rows.length > 0 ? 1 : 0,
      sampleNames: rows.slice(0, 3).map((r) => r.name),
    }
  } catch (err) {
    console.warn("[supplier-match]", {
      result: "db_failed",
      message: err instanceof Error ? err.message : "unknown",
    })
    return { count: 0, sampleNames: [] }
  }
}

const cachedMatch = unstable_cache(
  async (_cacheKey: string, tokens: string[]) => countFrSuppliersForTokens(tokens),
  ["radar-supplier-match-v1"],
  { revalidate: 3600 }
)

export async function matchAffisellFrSuppliers(title: string): Promise<SupplierMatchResult> {
  const tokens = extractMatchTokens(title)
  if (tokens.length === 0) return { count: 0, sampleNames: [] }
  const key = tokens.join("|")
  return cachedMatch(key, tokens)
}

/** Batch match for winners — graceful empty on DB failure. */
export async function matchSuppliersForWinners(
  titles: string[]
): Promise<Map<string, SupplierMatchResult>> {
  const map = new Map<string, SupplierMatchResult>()
  await Promise.all(
    titles.map(async (title) => {
      const result = await matchAffisellFrSuppliers(title).catch(() => ({
        count: 0,
        sampleNames: [] as string[],
      }))
      map.set(title, result)
    })
  )
  return map
}
