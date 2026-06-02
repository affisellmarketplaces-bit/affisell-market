-- Merchant legal status + signup document drafts

CREATE TABLE "MerchantLegalProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalStatus" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "legalEntityName" TEXT,
    "tradeName" TEXT,
    "siret" TEXT,
    "vatNumber" TEXT,
    "rnaNumber" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'FR',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantLegalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantLegalDocument" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantLegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SignupDocumentDraft" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupDocumentDraft_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "buyerAccountType" TEXT;

CREATE UNIQUE INDEX "MerchantLegalProfile_userId_key" ON "MerchantLegalProfile"("userId");
CREATE INDEX "MerchantLegalProfile_verificationStatus_idx" ON "MerchantLegalProfile"("verificationStatus");
CREATE INDEX "MerchantLegalProfile_legalStatus_idx" ON "MerchantLegalProfile"("legalStatus");

CREATE UNIQUE INDEX "MerchantLegalDocument_profileId_documentType_key" ON "MerchantLegalDocument"("profileId", "documentType");
CREATE INDEX "MerchantLegalDocument_profileId_idx" ON "MerchantLegalDocument"("profileId");

CREATE UNIQUE INDEX "SignupDocumentDraft_draftId_documentType_key" ON "SignupDocumentDraft"("draftId", "documentType");
CREATE INDEX "SignupDocumentDraft_draftId_idx" ON "SignupDocumentDraft"("draftId");
CREATE INDEX "SignupDocumentDraft_expiresAt_idx" ON "SignupDocumentDraft"("expiresAt");

ALTER TABLE "MerchantLegalProfile" ADD CONSTRAINT "MerchantLegalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantLegalDocument" ADD CONSTRAINT "MerchantLegalDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MerchantLegalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
