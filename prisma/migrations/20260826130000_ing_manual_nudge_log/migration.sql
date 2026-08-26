-- Ing manual fulfillment nudge anti-spam log (48h cooldown per supplier)
CREATE TABLE "IngManualNudgeLog" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "groupsCount" INTEGER NOT NULL DEFAULT 0,
    "resendId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngManualNudgeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IngManualNudgeLog_supplierId_createdAt_idx" ON "IngManualNudgeLog"("supplierId", "createdAt");
