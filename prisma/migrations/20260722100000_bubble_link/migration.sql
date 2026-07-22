-- CreateTable
CREATE TABLE "BubbleLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "affiliateProductId" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BubbleLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BubbleLink_token_key" ON "BubbleLink"("token");

-- CreateIndex
CREATE INDEX "BubbleLink_productId_idx" ON "BubbleLink"("productId");

-- CreateIndex
CREATE INDEX "BubbleLink_createdById_idx" ON "BubbleLink"("createdById");
