-- Phase 4: China buying persistence, agent ledger, SMS reminder

-- CreateEnum
CREATE TYPE "ChinaBuyRouteStatus" AS ENUM ('STUB', 'ROUTED', 'API_OK', 'API_FAIL');

-- CreateEnum
CREATE TYPE "AgentLedgerEntryType" AS ENUM ('CREDIT', 'DEBIT');

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "chinaBuyingAgentId" TEXT;
ALTER TABLE "Product" ADD COLUMN "chinaPlatform" TEXT;

-- AlterTable SourcingAgent
ALTER TABLE "SourcingAgent" ADD COLUMN "balanceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SourcingAgent" ADD COLUMN "lifetimeEarningsCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable AgentMission
ALTER TABLE "AgentMission" ADD COLUMN "smsReminderAt" TIMESTAMP(3);

-- CreateTable ChinaBuyRouteLog
CREATE TABLE "ChinaBuyRouteLog" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT,
    "agentId" TEXT NOT NULL,
    "platform" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "status" "ChinaBuyRouteStatus" NOT NULL DEFAULT 'STUB',
    "externalRef" TEXT,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChinaBuyRouteLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable AgentLedgerEntry
CREATE TABLE "AgentLedgerEntry" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "missionId" TEXT,
    "type" "AgentLedgerEntryType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfterCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChinaBuyRouteLog_idempotencyKey_key" ON "ChinaBuyRouteLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ChinaBuyRouteLog_supplierId_createdAt_idx" ON "ChinaBuyRouteLog"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "ChinaBuyRouteLog_productId_idx" ON "ChinaBuyRouteLog"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentLedgerEntry_missionId_key" ON "AgentLedgerEntry"("missionId");

-- CreateIndex
CREATE INDEX "AgentLedgerEntry_agentId_createdAt_idx" ON "AgentLedgerEntry"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMission_status_assignedAt_smsReminderAt_idx" ON "AgentMission"("status", "assignedAt", "smsReminderAt");

-- AddForeignKey
ALTER TABLE "ChinaBuyRouteLog" ADD CONSTRAINT "ChinaBuyRouteLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLedgerEntry" ADD CONSTRAINT "AgentLedgerEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "SourcingAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLedgerEntry" ADD CONSTRAINT "AgentLedgerEntry_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "AgentMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
