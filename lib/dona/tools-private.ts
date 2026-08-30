import "server-only"

import { tool } from "ai"
import { z } from "zod"

import { getEnvInfo } from "@/lib/env"
import { prisma } from "@/lib/prisma"

const DB_ERROR = "DB temporairement inaccessible, Capitaine"

async function withPrivateDb<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (e) {
    console.error("[dona-tools-private]", {
      result: "db_error",
      message: e instanceof Error ? e.message : String(e),
    })
    return { error: DB_ERROR }
  }
}

export const privateTools = {
  getMarketplaceStats: tool({
    description:
      "Stats globales Affisell pour Capitaine: boutiques domaine vérifié, en attente de vérif, total produits catalogue.",
    inputSchema: z.object({}),
    execute: async () =>
      withPrivateDb(async () => {
        const [verified, pending, products] = await Promise.all([
          prisma.store.count({ where: { domainVerified: true } }),
          prisma.store.count({ where: { domainVerified: false } }),
          prisma.product.count(),
        ])
        return { verified, pending, products }
      }),
  }),

  getEnvStatus: tool({
    description:
      "Statut runtime Neon: prod vs staging, endpoint DB slug. Appeler pour questions env / branche.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const info = getEnvInfo()
        return {
          env: info.env,
          branch: info.branch,
          dbHost: info.dbHost,
          endpoint: info.dbHost,
          isProd: info.isProd,
        }
      } catch (e) {
        console.error("[dona-tools-private] getEnvStatus", e)
        return { error: DB_ERROR }
      }
    },
  }),

  searchBoutiques: tool({
    description: "Cherche une boutique Affisell par nom (max 5 résultats, read-only).",
    inputSchema: z.object({
      q: z.string().min(1).describe("Fragment du nom de boutique"),
    }),
    execute: async ({ q }: { q: string }) =>
      withPrivateDb(async () => {
        const rows = await prisma.store.findMany({
          where: { name: { contains: q.trim(), mode: "insensitive" } },
          select: {
            name: true,
            slug: true,
            domainVerified: true,
            createdAt: true,
          },
          take: 5,
        })
        return {
          query: q.trim(),
          boutiques: rows.map((s) => ({
            name: s.name,
            slug: s.slug,
            verified: s.domainVerified,
            createdAt: s.createdAt.toISOString(),
          })),
        }
      }),
  }),

  getTopProducts: tool({
    description:
      "Top 5 produits marketplace par conversions puis clics (listings affiliés actifs).",
    inputSchema: z.object({}),
    execute: async () =>
      withPrivateDb(async () => {
        const rows = await prisma.affiliateProduct.findMany({
          where: { isListed: true },
          orderBy: [{ conversions: "desc" }, { clicks: "desc" }],
          take: 5,
          select: {
            id: true,
            clicks: true,
            conversions: true,
            customTitle: true,
            product: { select: { name: true, averageRating: true } },
          },
        })
        return {
          products: rows.map((r, i) => ({
            rank: i + 1,
            title: r.customTitle ?? r.product.name,
            clicks: r.clicks,
            conversions: r.conversions,
            rating: r.product.averageRating,
          })),
        }
      }),
  }),

  getRecentShops: tool({
    description: "5 dernières boutiques inscrites sur Affisell (read-only).",
    inputSchema: z.object({}),
    execute: async () =>
      withPrivateDb(async () => {
        const rows = await prisma.store.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            name: true,
            slug: true,
            domainVerified: true,
            createdAt: true,
          },
        })
        return {
          shops: rows.map((s) => ({
            name: s.name,
            slug: s.slug,
            verified: s.domainVerified,
            createdAt: s.createdAt.toISOString(),
          })),
        }
      }),
  }),
}

export type DonaPrivateTools = typeof privateTools
