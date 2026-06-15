-- Sprint 21: permanently suppress waitlist rows after a second hard bounce
ALTER TABLE "CheckoutLaunchWaitlist" ADD COLUMN "launchEmailSuppressedAt" TIMESTAMP(3);

CREATE INDEX "CheckoutLaunchWaitlist_marketRegion_launchEmailSuppressedAt_idx"
  ON "CheckoutLaunchWaitlist"("marketRegion", "launchEmailSuppressedAt");
