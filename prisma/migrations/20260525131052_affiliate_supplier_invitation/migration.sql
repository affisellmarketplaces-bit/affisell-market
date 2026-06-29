-- CreateTable
CREATE TABLE "SupplierExtensionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Browser',
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierExtensionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierExtensionToken_tokenHash_key" ON "SupplierExtensionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SupplierExtensionToken_userId_idx" ON "SupplierExtensionToken"("userId");

-- AddForeignKey
ALTER TABLE "SupplierExtensionToken" ADD CONSTRAINT "SupplierExtensionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
