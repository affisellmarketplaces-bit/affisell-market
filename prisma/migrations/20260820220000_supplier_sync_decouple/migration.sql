-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stats" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "sourceIntegrationId" TEXT,
ADD COLUMN "isDecoupled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "imageSource" TEXT;

-- CreateIndex
CREATE INDEX "SyncJob_integrationId_status_idx" ON "SyncJob"("integrationId", "status");

-- CreateIndex
CREATE INDEX "SyncJob_createdAt_idx" ON "SyncJob"("createdAt");

-- CreateIndex
CREATE INDEX "Product_sourceIntegrationId_idx" ON "Product"("sourceIntegrationId");

-- CreateIndex
CREATE INDEX "Product_supplierId_isDecoupled_idx" ON "Product"("supplierId", "isDecoupled");

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "SupplierIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
