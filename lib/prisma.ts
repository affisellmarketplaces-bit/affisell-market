import { PrismaClient } from "@prisma/client"

const globalForPrisma = global as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

/** Pour `instrumentation.ts`. */
export async function connectPrismaWithRetry(): Promise<void> {
  try {
    await prisma.$connect()
  } catch (e) {
    console.warn("[prisma] $connect:", e)
  }
}

export default prisma
