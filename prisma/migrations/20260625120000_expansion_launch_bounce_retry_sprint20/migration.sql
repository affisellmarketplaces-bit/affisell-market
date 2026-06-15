-- Sprint 20: track launch-email hard bounces for one auto-retry via expansion-ops cron
ALTER TABLE "CheckoutLaunchWaitlist" ADD COLUMN "launchEmailBouncedAt" TIMESTAMP(3);

CREATE INDEX "CheckoutLaunchWaitlist_marketRegion_launchEmailBouncedAt_idx"
  ON "CheckoutLaunchWaitlist"("marketRegion", "launchEmailBouncedAt");
