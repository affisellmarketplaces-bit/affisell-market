-- Avocat Numérique Sprint 4 — generated documents + e-signature
CREATE TABLE "AvocatLegalDocument" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvocatLegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvocatSigningToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "supplierId" TEXT,
    "signerEmail" TEXT NOT NULL,
    "signerName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signatureData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvocatSigningToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvocatSignatureLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "signingTokenId" TEXT,
    "signerEmail" TEXT NOT NULL,
    "signerName" TEXT,
    "signatureData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvocatSignatureLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AvocatSigningToken_token_key" ON "AvocatSigningToken"("token");
CREATE INDEX "AvocatLegalDocument_type_status_idx" ON "AvocatLegalDocument"("type", "status");
CREATE INDEX "AvocatLegalDocument_createdAt_idx" ON "AvocatLegalDocument"("createdAt");
CREATE INDEX "AvocatSigningToken_token_idx" ON "AvocatSigningToken"("token");
CREATE INDEX "AvocatSigningToken_documentId_idx" ON "AvocatSigningToken"("documentId");
CREATE INDEX "AvocatSignatureLog_documentId_idx" ON "AvocatSignatureLog"("documentId");
CREATE INDEX "AvocatSignatureLog_createdAt_idx" ON "AvocatSignatureLog"("createdAt");

ALTER TABLE "AvocatSigningToken" ADD CONSTRAINT "AvocatSigningToken_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AvocatLegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
