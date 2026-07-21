-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceCountry" TEXT NOT NULL,
    "products" JSONB NOT NULL,
    "destination" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_userId_status_idx" ON "ImportJob"("userId", "status");

-- CreateIndex
CREATE INDEX "ImportJob_userId_createdAt_idx" ON "ImportJob"("userId", "createdAt");
