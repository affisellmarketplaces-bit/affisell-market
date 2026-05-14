-- AlterTable
ALTER TABLE "Product" ADD COLUMN "descriptionIllustrationImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN "descriptionIllustrationVideos" TEXT[] DEFAULT ARRAY[]::TEXT[];
