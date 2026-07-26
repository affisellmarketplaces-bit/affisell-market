import { prisma } from "@/lib/prisma"

let ensured = false

/**
 * Idempotent DDL so Ghost Checkout columns exist before cron migrate finishes.
 * Safe to re-run (IF NOT EXISTS).
 */
export async function ensureGhostStockSchema(): Promise<boolean> {
  if (ensured) return true
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
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Product_lastStockCheck_idx" ON "Product"("lastStockCheck")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Product_supplierSource_lastStockStatus_idx" ON "Product"("supplierSource", "lastStockStatus")`
    )

    ensured = true
    console.log("[ghost]", { result: "schema_ensured" })
    return true
  } catch (e) {
    console.log("[ghost]", {
      result: "schema_ensure_failed",
      error: e instanceof Error ? e.message : String(e),
    })
    return false
  }
}
