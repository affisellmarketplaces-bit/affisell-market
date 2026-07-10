-- Supplier outreach CRM

CREATE TYPE "LeadStatus" AS ENUM ('CONTACTED', 'REPLIED', 'DEMO_BOOKED', 'CONVERTED', 'LOST');

CREATE TABLE "SupplierLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "firstName" TEXT,
    "linkedinUrl" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'CONTACTED',
    "source" TEXT NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" TIMESTAMP(3),
    "demoAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "convertedUserId" TEXT,
    "notes" TEXT,

    CONSTRAINT "SupplierLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierLead_email_key" ON "SupplierLead"("email");
CREATE INDEX "SupplierLead_status_idx" ON "SupplierLead"("status");
CREATE INDEX "SupplierLead_source_idx" ON "SupplierLead"("source");
CREATE INDEX "SupplierLead_contactedAt_idx" ON "SupplierLead"("contactedAt");

ALTER TABLE "SupplierLead"
ADD CONSTRAINT "SupplierLead_convertedUserId_fkey"
FOREIGN KEY ("convertedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
