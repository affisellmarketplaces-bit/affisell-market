ALTER TABLE "VideoGenerationJob" ADD COLUMN IF NOT EXISTS "jobId" TEXT;
ALTER TABLE "VideoGenerationJob" ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT '9:16';
ALTER TABLE "VideoGenerationJob" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "VideoGenerationJob_jobId_key" ON "VideoGenerationJob"("jobId");

UPDATE "VideoGenerationJob" SET "status" = 'PROCESSING' WHERE "status" = 'pending';
UPDATE "VideoGenerationJob" SET "status" = 'DONE' WHERE "status" = 'ready';
UPDATE "VideoGenerationJob" SET "status" = 'FAILED' WHERE "status" = 'failed';
