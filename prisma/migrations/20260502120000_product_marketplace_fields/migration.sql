-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shipsFrom" TEXT,
ADD COLUMN     "deliveryDays" INTEGER,
ADD COLUMN     "freeShipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierTag" TEXT;
