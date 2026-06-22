-- Try Before You Buy — apparel virtual try-on (Replicate IDM-VTON)

ALTER TABLE "Product" ADD COLUMN "tryOnEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "tryOnGarmentUrl" TEXT;

CREATE TYPE "TryOnJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

CREATE TABLE "TryOnJob" (
    "id" TEXT NOT NULL,
    "status" "TryOnJobStatus" NOT NULL DEFAULT 'PENDING',
    "replicatePredictionId" TEXT,
    "productId" TEXT NOT NULL,
    "affiliateProductId" TEXT,
    "inputUrl" TEXT NOT NULL,
    "garmentUrl" TEXT NOT NULL,
    "outputUrl" TEXT,
    "errorMessage" TEXT,
    "userId" TEXT,
    "anonId" TEXT,
    "ipHash" TEXT,
    "modelVersion" TEXT NOT NULL DEFAULT 'idm-vton',
    "latencyMs" INTEGER,
    "gdprConsentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TryOnJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TryOn" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT,
    "productId" TEXT NOT NULL,
    "affiliateProductId" TEXT,
    "inputUrl" TEXT NOT NULL,
    "outputUrl" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "angle" TEXT NOT NULL DEFAULT 'front',
    "resultHash" TEXT NOT NULL,
    "inputDeletedAt" TIMESTAMP(3),
    "outputExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TryOn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TryOnJob_replicatePredictionId_key" ON "TryOnJob"("replicatePredictionId");
CREATE INDEX "TryOnJob_status_createdAt_idx" ON "TryOnJob"("status", "createdAt");
CREATE INDEX "TryOnJob_userId_idx" ON "TryOnJob"("userId");
CREATE INDEX "TryOnJob_anonId_idx" ON "TryOnJob"("anonId");
CREATE INDEX "TryOnJob_ipHash_idx" ON "TryOnJob"("ipHash");

CREATE UNIQUE INDEX "TryOn_jobId_key" ON "TryOn"("jobId");
CREATE UNIQUE INDEX "TryOn_resultHash_key" ON "TryOn"("resultHash");
CREATE INDEX "TryOn_userId_createdAt_idx" ON "TryOn"("userId", "createdAt");
CREATE INDEX "TryOn_productId_idx" ON "TryOn"("productId");
CREATE INDEX "TryOn_resultHash_idx" ON "TryOn"("resultHash");
CREATE INDEX "TryOn_outputExpiresAt_idx" ON "TryOn"("outputExpiresAt");

ALTER TABLE "TryOnJob" ADD CONSTRAINT "TryOnJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TryOnJob" ADD CONSTRAINT "TryOnJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TryOn" ADD CONSTRAINT "TryOn_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TryOnJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TryOn" ADD CONSTRAINT "TryOn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TryOn" ADD CONSTRAINT "TryOn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
