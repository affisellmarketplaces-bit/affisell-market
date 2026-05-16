-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "videoAdPrompt" TEXT,
ALTER COLUMN "videoAdStatus" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VideoGenerationJob" ALTER COLUMN "updatedAt" DROP DEFAULT;
