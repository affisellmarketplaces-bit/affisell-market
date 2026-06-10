-- Phase 6: agent Stripe withdraw ledger, China buy webhook fields

ALTER TABLE "AgentLedgerEntry" ADD COLUMN "stripeTransferId" TEXT;
ALTER TABLE "AgentLedgerEntry" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "AgentLedgerEntry_stripeTransferId_key" ON "AgentLedgerEntry"("stripeTransferId");
CREATE UNIQUE INDEX "AgentLedgerEntry_idempotencyKey_key" ON "AgentLedgerEntry"("idempotencyKey");

ALTER TABLE "ChinaBuyRouteLog" ADD COLUMN "orderId" TEXT;
ALTER TABLE "ChinaBuyRouteLog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ChinaBuyRouteLog_agentId_externalRef_idx" ON "ChinaBuyRouteLog"("agentId", "externalRef");
CREATE INDEX "ChinaBuyRouteLog_orderId_idx" ON "ChinaBuyRouteLog"("orderId");
