import { prisma } from "@/lib/prisma"

let ensured = false
let ensurePromise: Promise<boolean> | null = null

async function addConstraintIfMissing(sql: string): Promise<void> {
  // Postgres logs 42710 through Prisma before catch — use DO/EXCEPTION instead.
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ${sql};
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

async function ensureOnce(): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PulseBattle" (
        "id" TEXT NOT NULL,
        "productAId" TEXT NOT NULL,
        "productBId" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "scheduledAt" TIMESTAMP(3) NOT NULL,
        "startedAt" TIMESTAMP(3),
        "endedAt" TIMESTAMP(3),
        "winnerId" TEXT,
        "votesA" INTEGER NOT NULL DEFAULT 0,
        "votesB" INTEGER NOT NULL DEFAULT 0,
        "totalVoters" INTEGER NOT NULL DEFAULT 0,
        "flashDiscount" INTEGER NOT NULL DEFAULT 20,
        "flashEndsAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PulseBattle_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PulseBattleVote" (
        "id" TEXT NOT NULL,
        "battleId" TEXT NOT NULL,
        "productId" TEXT NOT NULL,
        "userId" TEXT,
        "ip" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PulseBattleVote_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PulseBattle_status_scheduledAt_idx" ON "PulseBattle"("status", "scheduledAt")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PulseBattle_status_startedAt_idx" ON "PulseBattle"("status", "startedAt")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PulseBattleVote_battleId_userId_idx" ON "PulseBattleVote"("battleId", "userId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PulseBattleVote_battleId_ip_idx" ON "PulseBattleVote"("battleId", "ip")`
    )

    // Battle legal columns (reseller flash % + DGCCRF 30d reference)
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "PulseBattle" ADD COLUMN IF NOT EXISTS "flashDiscountSetBy" TEXT`
      )
    } catch {
      /* duplicate ok */
    }
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "PulseBattle" ADD COLUMN IF NOT EXISTS "priceReferenceCents" INTEGER`
      )
    } catch {
      /* duplicate ok */
    }
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "PulseBattle" ADD COLUMN IF NOT EXISTS "priceReferenceSource" TEXT DEFAULT 'lowest_30d'`
      )
    } catch {
      /* duplicate ok */
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PriceHistory" (
        "id" TEXT NOT NULL,
        "listingId" TEXT NOT NULL,
        "priceCents" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PriceHistory_listingId_createdAt_idx" ON "PriceHistory"("listingId", "createdAt")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PriceHistory_listingId_idx" ON "PriceHistory"("listingId")`
    )

    await addConstraintIfMissing(`
      ALTER TABLE "PulseBattle" ADD CONSTRAINT "PulseBattle_productAId_fkey"
        FOREIGN KEY ("productAId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `)
    await addConstraintIfMissing(`
      ALTER TABLE "PulseBattle" ADD CONSTRAINT "PulseBattle_productBId_fkey"
        FOREIGN KEY ("productBId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `)
    await addConstraintIfMissing(`
      ALTER TABLE "PulseBattleVote" ADD CONSTRAINT "PulseBattleVote_battleId_fkey"
        FOREIGN KEY ("battleId") REFERENCES "PulseBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `)

    ensured = true
    console.log("[pulse-battle]", { result: "schema_ensured" })
    return true
  } catch (e) {
    console.log("[pulse-battle]", {
      result: "schema_ensure_failed",
      error: e instanceof Error ? e.message : String(e),
    })
    return false
  }
}

/**
 * Idempotent DDL so Pulse Battle works before cron migrate finishes.
 * Safe to re-run (IF NOT EXISTS / duplicate_object). Concurrent callers share one promise.
 */
export async function ensurePulseBattleSchema(): Promise<boolean> {
  if (ensured) return true
  if (ensurePromise) return ensurePromise
  ensurePromise = ensureOnce().finally(() => {
    ensurePromise = null
  })
  return ensurePromise
}
