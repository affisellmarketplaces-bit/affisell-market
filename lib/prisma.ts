import { PrismaClient } from "@prisma/client"

export const prisma = (globalThis as any).prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  ;(globalThis as any).prisma = prisma
}

/** Pour `instrumentation.ts`. */
export async function connectPrismaWithRetry(): Promise<void> {
  try {
    await prisma.$connect()
  } catch (e) {
    console.warn("[prisma] $connect:", e)
  }
}

export default prisma
