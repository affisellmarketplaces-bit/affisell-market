-- CGU acceptance (distinct from role-specific CGS/CGA in termsAcceptedVersion)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cguAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cguVersion" TEXT;
