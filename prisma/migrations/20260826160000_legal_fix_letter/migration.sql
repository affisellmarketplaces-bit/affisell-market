-- Legal Guardian Sprint 3 — auto-fix audit + generated letters
CREATE TABLE "LegalFixLog" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "appliedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalFixLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalLetter" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "scanId" TEXT,
    "type" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegalFixLog_scanId_idx" ON "LegalFixLog"("scanId");
CREATE INDEX "LegalFixLog_productId_idx" ON "LegalFixLog"("productId");
CREATE INDEX "LegalFixLog_createdAt_idx" ON "LegalFixLog"("createdAt");

CREATE INDEX "LegalLetter_supplierId_idx" ON "LegalLetter"("supplierId");
CREATE INDEX "LegalLetter_scanId_idx" ON "LegalLetter"("scanId");
CREATE INDEX "LegalLetter_createdAt_idx" ON "LegalLetter"("createdAt");
