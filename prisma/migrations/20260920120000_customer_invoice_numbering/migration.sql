-- Continuous customer-invoice numbering per issuer and year. Additive and idempotent.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerInvoiceNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerInvoicedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_customerInvoiceNumber_key" ON "Order"("customerInvoiceNumber");

CREATE TABLE IF NOT EXISTS "InvoiceSequence" (
    "issuerKey" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("issuerKey", "year")
);
