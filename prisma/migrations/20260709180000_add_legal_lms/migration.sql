-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('CGU', 'CGV', 'SUPPLIER_AGREEMENT', 'AFFILIATE_AGREEMENT', 'PRIVACY_POLICY', 'COOKIES_POLICY', 'REFUND_POLICY', 'PAYMENTS_POLICY', 'DAC7_POLICY', 'VAT_POLICY', 'LEGAL_NOTICE', 'AFFISELL_PLUS');

-- CreateEnum
CREATE TYPE "LegalAcceptanceContext" AS ENUM ('SIGNUP', 'CHECKOUT', 'REACCEPT_MODAL', 'ONBOARDING', 'ADMIN_OVERRIDE', 'MIGRATION_BACKFILL');

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requiresAccept" BOOLEAN NOT NULL DEFAULT false,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "language" VARCHAR(8) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,
    "changelog" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecatedAt" TIMESTAMP(3),

    CONSTRAINT "LegalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "documentVersionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(45) NOT NULL,
    "userAgent" TEXT NOT NULL,
    "context" "LegalAcceptanceContext" NOT NULL,
    "orderId" TEXT,
    "buyerEmail" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "value" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "LegalPolicy_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cgvVersionId" TEXT,
ADD COLUMN "cgvAcceptedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_slug_key" ON "LegalDocument"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_currentVersionId_key" ON "LegalDocument"("currentVersionId");

-- CreateIndex
CREATE INDEX "LegalDocument_type_idx" ON "LegalDocument"("type");

-- CreateIndex
CREATE INDEX "LegalDocument_category_idx" ON "LegalDocument"("category");

-- CreateIndex
CREATE INDEX "LegalVersion_documentId_language_publishedAt_idx" ON "LegalVersion"("documentId", "language", "publishedAt");

-- CreateIndex
CREATE INDEX "LegalVersion_contentHash_idx" ON "LegalVersion"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "LegalVersion_documentId_version_language_key" ON "LegalVersion"("documentId", "version", "language");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_idempotencyKey_key" ON "LegalAcceptance"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LegalAcceptance_userId_documentVersionId_idx" ON "LegalAcceptance"("userId", "documentVersionId");

-- CreateIndex
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_orderId_idx" ON "LegalAcceptance"("orderId");

-- CreateIndex
CREATE INDEX "LegalAcceptance_documentVersionId_idx" ON "LegalAcceptance"("documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalPolicy_key_key" ON "LegalPolicy"("key");

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "LegalVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalVersion" ADD CONSTRAINT "LegalVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "LegalVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cgvVersionId_fkey" FOREIGN KEY ("cgvVersionId") REFERENCES "LegalVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
