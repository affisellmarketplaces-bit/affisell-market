-- Rename IngManualNudgeLog → IngNudgeLog (cron anti-spam)
ALTER TABLE "IngManualNudgeLog" RENAME TO "IngNudgeLog";
ALTER TABLE "IngNudgeLog" RENAME CONSTRAINT "IngManualNudgeLog_pkey" TO "IngNudgeLog_pkey";
ALTER INDEX "IngManualNudgeLog_supplierId_createdAt_idx" RENAME TO "IngNudgeLog_supplierId_createdAt_idx";
