-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "resellerEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "quantity" INTEGER NOT NULL DEFAULT 100,
    "targetPrice" DOUBLE PRECISION,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRequest_status_idx" ON "ProductRequest"("status");

-- CreateIndex
CREATE INDEX "ProductRequest_category_idx" ON "ProductRequest"("category");

-- CreateIndex
CREATE INDEX "ProductRequest_resellerId_createdAt_idx" ON "ProductRequest"("resellerId", "createdAt");
