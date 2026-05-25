-- AlterTable
ALTER TABLE "Store" ADD COLUMN "vercelDomainStatus" TEXT,
ADD COLUMN "vercelDomainError" TEXT,
ADD COLUMN "vercelDomainSyncedAt" TIMESTAMP(3);
