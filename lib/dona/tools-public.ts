import "server-only"

import { tool } from "ai"
import { z } from "zod"

import { buildDonaBestsellerToolOutput } from "@/lib/dona/dona-bestsellers"
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

function dbErrorLines(error: string): string[] {
  return [JSON.stringify({ t: "err", m: error })]
}

export const publicBuyerTools = {
  getBestsellers: tool({
    description:
      "Classement live ventes 7 jours (données réelles réseau Affisell). Utiliser pour « produit le plus vendu », « best-seller », « top ventes », « classement » — pas searchProducts.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(5).optional(),
    }),
    execute: async ({ limit }) => {
      const wrapped = await withPublicDb(async () => {
        const lines = await buildDonaBestsellerToolOutput(limit ?? 3)
        logBusiness("dona-public", {
          result: "get_bestsellers",
          hits: lines.filter((l) => l.includes("listingId")).length,
        })
        return lines
      })
      if (wrapped && typeof wrapped === "object" && "error" in wrapped) {
        return dbErrorLines(wrapped.error)
      }
      return wrapped
    },
  }),

  searchProducts: tool({
    description:
      "Recherche catalogue par mot-clé (ex. montre, chaussures). Retourne url `/marketplace/{listingId}`. Ne pas utiliser pour best-sellers / plus vendu — utiliser getBestsellers.",
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
        return dbErrorLines(wrapped.error)
      }
      return wrapped
    },
  }),
}
