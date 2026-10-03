-- Category engine suggestion log (catalogue-learning loop). Additive only: one new table, nothing else touched.
CREATE TABLE IF NOT EXISTS "CategorySuggestionLog" (
  "id"          TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "leafId"      TEXT NOT NULL,
  "confidence"  DOUBLE PRECISION NOT NULL,
  "applied"     BOOLEAN NOT NULL DEFAULT false,
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CategorySuggestionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CategorySuggestionLog_productId_createdAt_idx" ON "CategorySuggestionLog"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "CategorySuggestionLog_createdAt_idx" ON "CategorySuggestionLog"("createdAt");
