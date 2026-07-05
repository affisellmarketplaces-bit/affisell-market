-- Storefront newsletter capture (affiliate shop LTV list).

CREATE TABLE "StoreNewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT,
    "source" TEXT NOT NULL DEFAULT 'storefront_newsletter',
    "welcomeEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreNewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreNewsletterSubscriber_storeId_email_key" ON "StoreNewsletterSubscriber"("storeId", "email");
CREATE INDEX "StoreNewsletterSubscriber_storeId_idx" ON "StoreNewsletterSubscriber"("storeId");
CREATE INDEX "StoreNewsletterSubscriber_email_idx" ON "StoreNewsletterSubscriber"("email");

ALTER TABLE "StoreNewsletterSubscriber" ADD CONSTRAINT "StoreNewsletterSubscriber_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
