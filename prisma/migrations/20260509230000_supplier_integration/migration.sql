-- CreateTable
CREATE TABLE "SupplierIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'main',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastSyncSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierIntegration_userId_idx" ON "SupplierIntegration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierIntegration_userId_platform_name_key" ON "SupplierIntegration"("userId", "platform", "name");

-- AddForeignKey
ALTER TABLE "SupplierIntegration" ADD CONSTRAINT "SupplierIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
