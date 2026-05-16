-- AlterTable: Meta AI webhook video fields
ALTER TABLE "Product" ADD COLUMN "videoAdUrl" TEXT,
ADD COLUMN "videoAdStatus" TEXT NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "VideoGenerationJob" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoGenerationJob_productId_idx" ON "VideoGenerationJob"("productId");

CREATE INDEX "VideoGenerationJob_status_idx" ON "VideoGenerationJob"("status");

-- AddForeignKey
ALTER TABLE "VideoGenerationJob" ADD CONSTRAINT "VideoGenerationJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
