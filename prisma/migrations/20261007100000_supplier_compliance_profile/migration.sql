-- GPSR defaults per supplier (manufacturer / EU responsible person). Additive, isolated table.

CREATE TABLE IF NOT EXISTS "SupplierComplianceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "manufacturerName" TEXT,
    "manufacturerAddress" TEXT,
    "manufacturerEmail" TEXT,
    "manufacturerCountry" TEXT,
    "euRepName" TEXT,
    "euRepAddress" TEXT,
    "euRepEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierComplianceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierComplianceProfile_userId_key" ON "SupplierComplianceProfile"("userId");

ALTER TABLE "SupplierComplianceProfile" DROP CONSTRAINT IF EXISTS "SupplierComplianceProfile_userId_fkey";
ALTER TABLE "SupplierComplianceProfile" ADD CONSTRAINT "SupplierComplianceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
