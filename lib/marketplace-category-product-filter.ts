import type { Prisma, PrismaClient } from "@prisma/client"

import { collectCategorySubtreeIds } from "@/lib/category-browse"

const MAX_TEXT_TOKENS = 28
const MIN_TOKEN_LEN = 5

export function significantTokens(names: string[]): string[] {
  const set = new Set<string>()
  for (const name of names) {
    for (const w of name.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= MIN_TOKEN_LEN) set.add(w)
    }
  }
  return [...set].slice(0, MAX_TEXT_TOKENS)
}

/**
 * Match marketplace products in a category subtree:
 * - `categoryId` / `subcategoryId` in subtree (any depth)
 * - legacy `categories[]` labels
 * - title/description keyword overlap with aisle names (uncategorized rows)
 */
export async function buildCategoryScopeProductFilter(
  client: PrismaClient,
  scopeRootId: string
): Promise<Prisma.ProductWhereInput> {
  const scopeIds = await collectCategorySubtreeIds(client, scopeRootId)
  const scopeCategories = await client.category.findMany({
    where: { id: { in: scopeIds } },
    select: { id: true, name: true },
  })
  const names = scopeCategories.map((c) => c.name).filter((n) => n.length > 0)
  const tokens = significantTokens(names)

  const or: Prisma.ProductWhereInput[] = [
    { categoryId: { in: scopeIds } },
    { subcategoryId: { in: scopeIds } },
  ]

  if (names.length > 0) {
    or.push({ categories: { hasSome: names } })
  }

  for (const token of tokens) {
    or.push({
      OR: [
        { name: { contains: token, mode: "insensitive" } },
        { description: { contains: token, mode: "insensitive" } },
      ],
    })
  }

  return { OR: or }
}
