import "server-only"

import { tool } from "ai"
import { z } from "zod"

import { buildDonaSearchToolLines } from "@/lib/dona/dona-search-tool-lines"
import { searchCatalogForDona } from "@/lib/dona/dona-catalog-search"
import { logBusiness } from "@/lib/business-log"
import { prisma } from "@/lib/prisma"

const DB_ERROR = "Catalogue temporairement inaccessible"

async function withPublicDb<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (e) {
    console.error("[dona-tools-public]", {
      result: "db_error",
      message: e instanceof Error ? e.message : String(e),
    })
    return { error: DB_ERROR }
  }
}

export const publicBuyerTools = {
  searchProducts: tool({
    description:
      "Recherche le catalogue acheteur Affisell. Retourne des listings réels avec url `/marketplace/{listingId}`. Appeler avant de citer un produit ou un lien.",
    inputSchema: z.object({
      query: z.string().min(1),
    }),
    execute: async ({ query }) => {
      const wrapped = await withPublicDb(async () => {
        const q = query.trim()
        const result = await searchCatalogForDona(prisma, q)
        logBusiness("dona-public", {
          result: "search_products",
          query: q.slice(0, 80),
          hits: result.products.length,
        })
        return buildDonaSearchToolLines(result)
      })
      if (wrapped && typeof wrapped === "object" && "error" in wrapped) {
        return [JSON.stringify({ t: "err", m: wrapped.error })]
      }
      return wrapped
    },
  }),
}
