-- Affisell Sentinel — persisted ops signals (admin-only)

CREATE TABLE "OpsSignal" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "metric" INTEGER,
    "entityType" TEXT,
    "entityId" TEXT,
    "playbook" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpsSignal_resolvedAt_severity_lastSeenAt_idx" ON "OpsSignal"("resolvedAt", "severity", "lastSeenAt");
CREATE INDEX "OpsSignal_domain_code_idx" ON "OpsSignal"("domain", "code");
