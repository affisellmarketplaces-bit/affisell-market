-- Supplier purchase claim: one row per purchase key, so a supplier order is placed at most once
-- (lib/supplier-purchase/guard.server.ts). Isolated table, no foreign key, read and written only by the guard.
CREATE TABLE "SupplierPurchaseClaim" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "supplierOrderId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPurchaseClaim_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierPurchaseClaim_status_check" CHECK ("status" IN ('claimed', 'placed', 'rejected', 'uncertain')),
    CONSTRAINT "SupplierPurchaseClaim_placed_has_order_check" CHECK ("status" <> 'placed' OR "supplierOrderId" IS NOT NULL)
);

CREATE INDEX "SupplierPurchaseClaim_status_updatedAt_idx" ON "SupplierPurchaseClaim"("status", "updatedAt");
