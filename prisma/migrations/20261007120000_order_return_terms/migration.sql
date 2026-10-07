-- Return window offered to the buyer at purchase (supplier-extended beyond the legal 14 days). Additive, isolated table.

CREATE TABLE IF NOT EXISTS "OrderReturnTerms" (
    "orderId" TEXT NOT NULL,
    "returnWindowDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReturnTerms_pkey" PRIMARY KEY ("orderId")
);
