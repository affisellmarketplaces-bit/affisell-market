import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient(): PrismaClient {
  return new PrismaClient()
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

/** Pour `instrumentation.ts`. */
export async function connectPrismaWithRetry(): Promise<void> {
  try {
    await prisma.$connect()
  } catch (e) {
    console.warn("[prisma] $connect:", e)
  }
}

/** Retry once after Neon idle disconnect (P1017). */
export async function withPrismaReconnect<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const code =
      typeof e === "object" && e !== null && "code" in e ? String((e as { code: string }).code) : ""
    if (code !== "P1017") throw e
    await prisma.$connect()
    return await fn()
  }
}

export default prisma
