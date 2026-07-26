import { prisma } from "@/lib/prisma"

let ensured = false

/**
 * Idempotent DDL so Pulse Battle works before cron migrate finishes.
 * Safe to re-run (IF NOT EXISTS).
 */
export async function ensurePulseBattleSchema(): Promise<boolean> {
  if (ensured) return true
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

    // FKs — ignore if already present or Product missing (shouldn't)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "PulseBattle" ADD CONSTRAINT "PulseBattle_productAId_fkey"
          FOREIGN KEY ("productAId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `)
    } catch {
      /* duplicate_object ok */
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "PulseBattle" ADD CONSTRAINT "PulseBattle_productBId_fkey"
          FOREIGN KEY ("productBId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `)
    } catch {
      /* duplicate_object ok */
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "PulseBattleVote" ADD CONSTRAINT "PulseBattleVote_battleId_fkey"
          FOREIGN KEY ("battleId") REFERENCES "PulseBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `)
    } catch {
      /* duplicate_object ok */
    }

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
