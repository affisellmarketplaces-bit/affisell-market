-- CreateTable
CREATE TABLE "AiConnectionKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'AI',
    "prefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConnectionKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyId" TEXT,
    "tool" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "input" JSONB,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiMission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiConnectionKey_tokenHash_key" ON "AiConnectionKey"("tokenHash");

-- CreateIndex
CREATE INDEX "AiConnectionKey_userId_idx" ON "AiConnectionKey"("userId");

-- CreateIndex
CREATE INDEX "AiMission_userId_createdAt_idx" ON "AiMission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiMission_keyId_idx" ON "AiMission"("keyId");

-- AddForeignKey
ALTER TABLE "AiConnectionKey" ADD CONSTRAINT "AiConnectionKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMission" ADD CONSTRAINT "AiMission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMission" ADD CONSTRAINT "AiMission_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "AiConnectionKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
