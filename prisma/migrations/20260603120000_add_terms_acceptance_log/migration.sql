-- Preuve opposable acceptation CGU / conditions (art. 1366 C. civ.)
CREATE TABLE IF NOT EXISTS "TermsAcceptanceLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsAcceptanceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TermsAcceptanceLog_userId_type_idx" ON "TermsAcceptanceLog"("userId", "type");

ALTER TABLE "TermsAcceptanceLog" DROP CONSTRAINT IF EXISTS "TermsAcceptanceLog_userId_fkey";
ALTER TABLE "TermsAcceptanceLog" ADD CONSTRAINT "TermsAcceptanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
