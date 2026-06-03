-- Demo lab feedback (suppliers, affiliates, buyers)

CREATE TYPE "DemoPersona" AS ENUM ('SUPPLIER', 'AFFILIATE', 'BUYER');

CREATE TABLE "DemoFeedback" (
    "id" TEXT NOT NULL,
    "persona" "DemoPersona" NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "email" TEXT,
    "locale" TEXT,
    "stepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemoFeedback_persona_createdAt_idx" ON "DemoFeedback"("persona", "createdAt");
