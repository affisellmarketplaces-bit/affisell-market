-- Sentinel v2 — scan snapshots for 7-day health trend

CREATE TABLE "OpsScanSnapshot" (
    "id" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "openP0" INTEGER NOT NULL DEFAULT 0,
    "openP1" INTEGER NOT NULL DEFAULT 0,
    "openP2" INTEGER NOT NULL DEFAULT 0,
    "openP3" INTEGER NOT NULL DEFAULT 0,
    "detected" INTEGER NOT NULL DEFAULT 0,
    "resolved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OpsScanSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpsScanSnapshot_scannedAt_idx" ON "OpsScanSnapshot"("scannedAt");
