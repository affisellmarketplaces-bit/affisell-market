[ensure-direct-url] DATABASE_URL_UNPOOLED normalized (pooler → direct for migrate)
-- DropIndex
DROP INDEX "AgentMission_supplierId_urgent_deadlineAt_idx";

-- DropIndex
DROP INDEX "Category_parentId_idx";

-- DropIndex
DROP INDEX "Order_deliveredAtSource_idx";

-- DropIndex
DROP INDEX "Order_trackingLockedAt_idx";

-- DropIndex
DROP INDEX "Product_medusaVariantId_idx";

-- DropIndex
DROP INDEX "ProductRequest_complianceRequirements_idx";

-- DropIndex
DROP INDEX "ProductRequest_provenanceCountries_idx";

-- DropIndex
DROP INDEX "ProductRequest_sourceProvenance_idx";

-- AlterTable
ALTER TABLE "Attribute" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BookingSlot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BookingWaitlist" ALTER COLUMN "notifiedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "smsNotifiedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChinaBuyRouteLog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IngNudgeLog" ALTER COLUMN "groupsCount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "bookingReminderHourSmsSentAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "bookingSupplierAlertSentAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "bookingSupplierDigestSentAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantPayoutLedger_stripeTransferId_key" ON "MerchantPayoutLedger"("stripeTransferId");

-- RenameIndex
ALTER INDEX "CheckoutLaunchWaitlist_countryIso2_marketRegion_launchNotifiedA" RENAME TO "CheckoutLaunchWaitlist_countryIso2_marketRegion_launchNotif_idx";

