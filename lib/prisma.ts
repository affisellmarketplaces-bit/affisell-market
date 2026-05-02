import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/** In development, avoid a singleton so HMR does not keep a stale engine after `prisma generate` / provider changes. */
export const prisma =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ??= new PrismaClient())
    : new PrismaClient()

/** Pour `instrumentation.ts`. */
export async function connectPrismaWithRetry(): Promise<void> {
  try {
    await prisma.$connect()
  } catch (e) {
    console.warn("[prisma] $connect:", e)
  }
}

export default prisma
