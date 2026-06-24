import { PrismaClient } from "@prisma/client"

let prisma: PrismaClient | null = null

/** Lazy Prisma client for Affisell catalog sync (optional — requires DATABASE_URL_PRISMA). */
export function getAffisellPrisma(): PrismaClient | null {
  const url = process.env.DATABASE_URL_PRISMA?.trim()
  if (!url) return null
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url } },
    })
  }
  return prisma
}
