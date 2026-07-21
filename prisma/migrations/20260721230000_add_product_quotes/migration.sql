-- AlterTable
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "quotesCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductQuote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT,
    "supplierEmail" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "moq" INTEGER NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductQuote_requestId_supplierId_key" ON "ProductQuote"("requestId", "supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductQuote_requestId_idx" ON "ProductQuote"("requestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductQuote_supplierId_idx" ON "ProductQuote"("supplierId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductQuote_requestId_fkey'
  ) THEN
    ALTER TABLE "ProductQuote"
      ADD CONSTRAINT "ProductQuote_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "ProductRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
