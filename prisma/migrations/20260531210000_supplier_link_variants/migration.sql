-- CreateTable
CREATE TABLE "SupplierLinkVariant" (
    "id" TEXT NOT NULL,
    "supplierLinkId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "matchColor" TEXT,
    "matchSize" TEXT,
    "aeSkuId" TEXT NOT NULL,
    "aePriceCents" INTEGER NOT NULL,
    "aeShippingCents" INTEGER NOT NULL DEFAULT 0,
    "aeLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierLinkVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierLinkVariant_supplierLinkId_idx" ON "SupplierLinkVariant"("supplierLinkId");

-- CreateIndex
CREATE INDEX "SupplierLinkVariant_supplierLinkId_matchColor_idx" ON "SupplierLinkVariant"("supplierLinkId", "matchColor");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLinkVariant_supplierLinkId_productVariantId_key" ON "SupplierLinkVariant"("supplierLinkId", "productVariantId");

-- AddForeignKey
ALTER TABLE "SupplierLinkVariant" ADD CONSTRAINT "SupplierLinkVariant_supplierLinkId_fkey" FOREIGN KEY ("supplierLinkId") REFERENCES "SupplierLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLinkVariant" ADD CONSTRAINT "SupplierLinkVariant_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
