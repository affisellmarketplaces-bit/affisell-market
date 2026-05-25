-- Affisell Pulse: community clips + view counts
ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "views" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "CommunityPost_createdAt_idx" ON "CommunityPost"("createdAt");
CREATE INDEX IF NOT EXISTS "CommunityPost_views_idx" ON "CommunityPost"("views");
