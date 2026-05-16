-- Google Product Taxonomy (FR) + browse metadata on Category

ALTER TABLE "Category" ADD COLUMN "googleId" INTEGER;
ALTER TABLE "Category" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Category" ADD COLUMN "fullPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Category" ADD COLUMN "isLeaf" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Category_googleId_key" ON "Category"("googleId");

CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_level_idx" ON "Category"("level");
