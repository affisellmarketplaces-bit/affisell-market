-- Legal Guardian — automated compliance scans (Avocat Numérique Sprint 2)
CREATE TABLE "LegalScan" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "issues" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegalScan_riskScore_idx" ON "LegalScan"("riskScore");
CREATE INDEX "LegalScan_status_idx" ON "LegalScan"("status");
CREATE INDEX "LegalScan_type_targetId_status_idx" ON "LegalScan"("type", "targetId", "status");
