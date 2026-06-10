-- Link SourcingAgent to User account (role AGENT) after admin activation

ALTER TABLE "SourcingAgent" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "SourcingAgent_userId_key" ON "SourcingAgent"("userId");

ALTER TABLE "SourcingAgent" ADD CONSTRAINT "SourcingAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
