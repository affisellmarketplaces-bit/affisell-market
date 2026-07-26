import { prisma } from "@/lib/prisma"

let ensured = false
let ensurePromise: Promise<boolean> | null = null

/**
 * Idempotent DDL so Ghost Checkout works before cron migrate finishes.
 * Safe to re-run (IF NOT EXISTS). Concurrent callers share one promise.
 */
export async function ensureGhostStockSchema(): Promise<boolean> {
  if (ensured) return true
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    try {
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

      ensured = true
      console.log("[ghost]", { result: "schema_ensured" })
      return true
    } catch (e) {
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
