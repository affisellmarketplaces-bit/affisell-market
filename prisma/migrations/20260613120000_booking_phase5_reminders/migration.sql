-- AlterTable
ALTER TABLE "Order" ADD COLUMN "bookingReminderDaySentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "bookingReminderHourSentAt" TIMESTAMP(3);
