-- Sprint 5 — DSA point contact, KYC, GPSR recalls, LegalProof audit trail
CREATE TABLE "DsaReport" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "supplierId" TEXT,
    "reporterEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proofUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "actionTaken" TEXT,

    CONSTRAINT "DsaReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycCheck" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "siret" TEXT,
    "tva" TEXT,
    "siretValid" BOOLEAN NOT NULL DEFAULT false,
    "tvaValid" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawData" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecall" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "lotNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notifiedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRecall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalProof" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "action" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KycCheck_supplierId_key" ON "KycCheck"("supplierId");
CREATE INDEX "DsaReport_status_createdAt_idx" ON "DsaReport"("status", "createdAt");
CREATE INDEX "DsaReport_productId_idx" ON "DsaReport"("productId");
CREATE INDEX "DsaReport_supplierId_idx" ON "DsaReport"("supplierId");
CREATE INDEX "KycCheck_status_idx" ON "KycCheck"("status");
CREATE INDEX "KycCheck_score_idx" ON "KycCheck"("score");
CREATE INDEX "ProductRecall_productId_idx" ON "ProductRecall"("productId");
CREATE INDEX "ProductRecall_status_createdAt_idx" ON "ProductRecall"("status", "createdAt");
CREATE INDEX "LegalProof_productId_timestamp_idx" ON "LegalProof"("productId", "timestamp");
CREATE INDEX "LegalProof_action_timestamp_idx" ON "LegalProof"("action", "timestamp");
