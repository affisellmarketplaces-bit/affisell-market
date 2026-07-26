-- Pulse Live Battle
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
);

CREATE TABLE IF NOT EXISTS "PulseBattleVote" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PulseBattleVote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PulseBattle_status_scheduledAt_idx" ON "PulseBattle"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "PulseBattle_status_startedAt_idx" ON "PulseBattle"("status", "startedAt");
CREATE INDEX IF NOT EXISTS "PulseBattle_productAId_idx" ON "PulseBattle"("productAId");
CREATE INDEX IF NOT EXISTS "PulseBattle_productBId_idx" ON "PulseBattle"("productBId");
CREATE INDEX IF NOT EXISTS "PulseBattleVote_battleId_userId_idx" ON "PulseBattleVote"("battleId", "userId");
CREATE INDEX IF NOT EXISTS "PulseBattleVote_battleId_ip_idx" ON "PulseBattleVote"("battleId", "ip");
CREATE INDEX IF NOT EXISTS "PulseBattleVote_battleId_createdAt_idx" ON "PulseBattleVote"("battleId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PulseBattle" ADD CONSTRAINT "PulseBattle_productAId_fkey"
    FOREIGN KEY ("productAId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PulseBattle" ADD CONSTRAINT "PulseBattle_productBId_fkey"
    FOREIGN KEY ("productBId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PulseBattleVote" ADD CONSTRAINT "PulseBattleVote_battleId_fkey"
    FOREIGN KEY ("battleId") REFERENCES "PulseBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
