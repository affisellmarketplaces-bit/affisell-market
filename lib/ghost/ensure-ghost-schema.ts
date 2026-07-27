import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

let ensured = false
let ensurePromise: Promise<boolean> | null = null

function isMissingGhostColumnError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    return true
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2022"
  ) {
    return true
  }
  const msg = error instanceof Error ? error.message : String(error)
  return /does not exist/i.test(msg)
}

async function applyGhostStockDdl(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierUrl" TEXT`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierSource" TEXT`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierProductId" TEXT`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastStockCheck" TIMESTAMP(3)`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastStockStatus" TEXT`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastPriceSupplier" DECIMAL(65,30)`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockCheckFails" INTEGER NOT NULL DEFAULT 0`
  )

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StockCheckLog" (
      "id" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "supplierPrice" DECIMAL(65,30),
      "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "responseTimeMs" INTEGER NOT NULL,
      "source" TEXT,
      CONSTRAINT "StockCheckLog_pkey" PRIMARY KEY ("id")
    )
  `)

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Product_lastStockCheck_idx" ON "Product"("lastStockCheck")`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Product_supplierSource_lastStockStatus_idx" ON "Product"("supplierSource", "lastStockStatus")`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "StockCheckLog_productId_checkedAt_idx" ON "StockCheckLog"("productId", "checkedAt")`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "StockCheckLog_checkedAt_idx" ON "StockCheckLog"("checkedAt")`
  )

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StockCheckLog" ADD CONSTRAINT "StockCheckLog_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `)
  } catch {
    /* duplicate_object ok */
  }
}

/**
 * Idempotent Ghost DDL — probe first, ALTER only when columns missing.
 * Safe to re-run. Concurrent callers share one promise.
 */
export async function ensureGhostStockSchema(options?: {
  force?: boolean
}): Promise<boolean> {
  if (ensured && !options?.force) return true
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    try {
      if (!options?.force) {
        try {
          await prisma.$queryRaw`SELECT "supplierUrl" FROM "Product" LIMIT 1`
          ensured = true
          return true
        } catch (probeError: unknown) {
          if (!isMissingGhostColumnError(probeError)) {
            console.log("[ghost]", {
              result: "schema_probe_failed",
              error:
                probeError instanceof Error ? probeError.message : String(probeError),
            })
            return false
          }
          console.log("[Ghost] Running fallback ensure...")
        }
      } else {
        console.log("[Ghost] Running fallback ensure...")
      }

      await applyGhostStockDdl()
      ensured = true
      console.log("[ghost]", { result: "schema_ensured" })
      return true
    } catch (e: unknown) {
      console.log("[ghost]", {
        result: "schema_ensure_failed",
        error: e instanceof Error ? e.message : String(e),
      })
      return false
    } finally {
      ensurePromise = null
    }
  })()

  return ensurePromise
}
