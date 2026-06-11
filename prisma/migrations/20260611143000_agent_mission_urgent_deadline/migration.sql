-- Agent missions: urgent flag + supplier deadline

ALTER TABLE "AgentMission" ADD COLUMN "urgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgentMission" ADD COLUMN "deadlineAt" TIMESTAMP(3);

CREATE INDEX "AgentMission_supplierId_urgent_deadlineAt_idx" ON "AgentMission"("supplierId", "urgent", "deadlineAt");
