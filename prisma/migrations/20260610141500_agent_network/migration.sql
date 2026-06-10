-- Affisell Agent Network: sourcing agents + inspection missions

-- CreateEnum
CREATE TYPE "AgentCapability" AS ENUM ('QC_INSPECTION', 'COMPLIANCE', 'PHOTO_PROOF', 'REPACK_EXPRESS');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "AgentMissionType" AS ENUM ('QC_INSPECTION', 'COMPLIANCE_CHECK', 'PHOTO_PROOF', 'REPACK_EXPRESS');

-- CreateEnum
CREATE TYPE "AgentMissionStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SourcingAgent" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "capabilities" "AgentCapability"[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ratingX10" INTEGER NOT NULL DEFAULT 45,
    "missionsDone" INTEGER NOT NULL DEFAULT 0,
    "leadTimeHours" INTEGER NOT NULL DEFAULT 48,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "contactEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcingAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMission" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT,
    "agentId" TEXT,
    "type" "AgentMissionType" NOT NULL,
    "status" "AgentMissionStatus" NOT NULL DEFAULT 'REQUESTED',
    "instructions" TEXT,
    "report" JSONB,
    "reportSummary" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "autoBuyPaused" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourcingAgent_contactEmail_key" ON "SourcingAgent"("contactEmail");

-- CreateIndex
CREATE INDEX "SourcingAgent_status_country_idx" ON "SourcingAgent"("status", "country");

-- CreateIndex
CREATE INDEX "AgentMission_supplierId_status_requestedAt_idx" ON "AgentMission"("supplierId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "AgentMission_agentId_status_idx" ON "AgentMission"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentMission_productId_idx" ON "AgentMission"("productId");

-- AddForeignKey
ALTER TABLE "AgentMission" ADD CONSTRAINT "AgentMission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMission" ADD CONSTRAINT "AgentMission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "SourcingAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
