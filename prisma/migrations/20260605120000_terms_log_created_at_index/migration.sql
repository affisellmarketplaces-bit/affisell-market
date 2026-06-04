-- Index audit + userAgent TEXT pour preuves longues (art. 1366)
CREATE INDEX IF NOT EXISTS "TermsAcceptanceLog_createdAt_idx" ON "TermsAcceptanceLog"("createdAt");
