-- Shop-level shipping profile: carriers the supplier offers (+ delivery windows). Idempotent.
CREATE TABLE IF NOT EXISTS "SupplierShippingProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offers" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierShippingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierShippingProfile_userId_key" ON "SupplierShippingProfile"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierShippingProfile_userId_fkey'
  ) THEN
    ALTER TABLE "SupplierShippingProfile"
      ADD CONSTRAINT "SupplierShippingProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
