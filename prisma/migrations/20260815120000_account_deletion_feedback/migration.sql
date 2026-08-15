-- Structured exit feedback before account deletion (analytics / product improvements)
CREATE TABLE IF NOT EXISTS "AccountDeletionFeedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "reasonDetail" TEXT,
  "source" TEXT NOT NULL,
  "locale" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountDeletionFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountDeletionFeedback_reasonCode_createdAt_idx"
  ON "AccountDeletionFeedback"("reasonCode", "createdAt");

CREATE INDEX IF NOT EXISTS "AccountDeletionFeedback_role_createdAt_idx"
  ON "AccountDeletionFeedback"("role", "createdAt");

CREATE INDEX IF NOT EXISTS "AccountDeletionFeedback_userId_createdAt_idx"
  ON "AccountDeletionFeedback"("userId", "createdAt");
