-- Auto subdomain SSL on Vercel: registered | pending | active | failed | skipped
ALTER TABLE "Store" ADD COLUMN "subdomainVercelStatus" TEXT,
ADD COLUMN "subdomainVercelError" TEXT,
ADD COLUMN "subdomainVercelSyncedAt" TIMESTAMP(3);
