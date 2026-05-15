-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierRecentCategories" JSONB NOT NULL DEFAULT '[]',
    "buyerRewardBalanceCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'main',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastSyncSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "aiAvatarUrl" TEXT,
    "bannerUrl" TEXT,
    "description" TEXT,
    "customDomain" TEXT,
    "domainVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "instagram" TEXT,
    "tiktok" TEXT,
    "youtube" TEXT,
    "twitch" TEXT,
    "facebook" TEXT,
    "twitter" TEXT,
    "followers" JSONB,
    "showSocialsOnStore" BOOLEAN NOT NULL DEFAULT true,
    "autoSyncFollowersDaily" BOOLEAN NOT NULL DEFAULT false,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "livePlatform" TEXT,
    "liveUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "shipFromAddress" JSONB,
    "returnAddress" JSONB,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📦',
    "order" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAttribute" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unit" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "aiSuggest" BOOLEAN NOT NULL DEFAULT true,
    "showInFilter" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionBullets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "descriptionIllustrationImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "descriptionIllustrationVideos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colorImages" JSONB,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variants" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "basePriceCents" INTEGER NOT NULL,
    "compareAt" DECIMAL(65,30),
    "commissionRate" INTEGER NOT NULL,
    "listingKind" TEXT NOT NULL DEFAULT 'PHYSICAL',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "style" TEXT,
    "shippingType" TEXT NOT NULL DEFAULT 'standard',
    "handlingDays" INTEGER NOT NULL DEFAULT 1,
    "isOnSale" BOOLEAN NOT NULL DEFAULT false,
    "isNewArrival" BOOLEAN NOT NULL DEFAULT false,
    "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
    "isRefurbished" BOOLEAN NOT NULL DEFAULT false,
    "hasCoupon" BOOLEAN NOT NULL DEFAULT false,
    "isEcoFriendly" BOOLEAN NOT NULL DEFAULT false,
    "shippingCountry" TEXT,
    "warehouseType" TEXT,
    "warehouseCity" TEXT,
    "processingTime" INTEGER NOT NULL DEFAULT 1,
    "deliveryMin" INTEGER NOT NULL DEFAULT 2,
    "deliveryMax" INTEGER NOT NULL DEFAULT 5,
    "shippingMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "freeShippingThreshold" DECIMAL(65,30),
    "shippingCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "shipsFrom" TEXT,
    "deliveryDays" INTEGER,
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "supplierTag" TEXT,
    "supplierSku" TEXT,
    "supplierWholesaleCents" INTEGER,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewSentiment" TEXT NOT NULL DEFAULT 'neutral',

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "suggestedCategory" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "country" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variant" TEXT,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetPriceCents" INTEGER,
    "previousPriceCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "query" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffisellTrackEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "productId" TEXT,
    "sessionId" TEXT,
    "userId" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffisellTrackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productId" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateProduct" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellingPriceCents" INTEGER NOT NULL,
    "customTitle" TEXT,
    "customDescription" TEXT,
    "customImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customSlug" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "collections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isListed" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "buyerRewardKind" TEXT NOT NULL DEFAULT 'NONE',
    "buyerRewardPercent" INTEGER NOT NULL DEFAULT 0,
    "promotedColor" TEXT,
    "promotedSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "affiliateProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "variantSignature" TEXT NOT NULL DEFAULT '',
    "selectedColor" TEXT,
    "selectedSize" TEXT,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerRewardLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerRewardLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "affiliateProductId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "buyerUserId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "variantLabel" TEXT,
    "basePriceCents" INTEGER NOT NULL,
    "sellingPriceCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "marginCents" INTEGER NOT NULL,
    "affiliatePayoutCents" INTEGER NOT NULL,
    "affisellFeeCents" INTEGER NOT NULL DEFAULT 0,
    "affiliateMarginRetainedCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "supplierPreparingAt" TIMESTAMP(3),
    "trackingCarrier" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveryConfirmedAt" TIMESTAMP(3),
    "deliveryConfirmedBy" TEXT,
    "payoutEligibleAt" TIMESTAMP(3),
    "supplierPayoutAt" TIMESTAMP(3),
    "affiliatePayoutAt" TIMESTAMP(3),
    "stripeSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantPayoutLedger" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "blindDropshipOrderId" TEXT,
    "userId" TEXT NOT NULL,
    "beneficiaryRole" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantPayoutLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReturn" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reasonCode" TEXT NOT NULL,
    "reasonDetail" TEXT,
    "evidenceUrls" JSONB NOT NULL DEFAULT '[]',
    "requestedRefundCents" INTEGER NOT NULL,
    "approvedRefundCents" INTEGER,
    "sellerNote" TEXT,
    "rejectionReason" TEXT,
    "buyerTrackingCarrier" TEXT,
    "buyerTrackingNumber" TEXT,
    "buyerShippedAt" TIMESTAMP(3),
    "sellerRespondByAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "orderId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "BlindDropshipSupplier" (
    "id" TEXT NOT NULL,
    "linkedUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiType" TEXT NOT NULL DEFAULT 'rest',
    "apiEndpoint" TEXT,
    "apiKeyEncrypted" TEXT NOT NULL,
    "billingType" TEXT NOT NULL DEFAULT 'wallet',
    "isBlindDropship" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastStockSyncAt" TIMESTAMP(3),
    "lastStockError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlindDropshipSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlindDropshipOrder" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "buyerUserId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "totalPaidCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "marginCents" INTEGER NOT NULL DEFAULT 0,
    "affisellFeeCents" INTEGER NOT NULL DEFAULT 0,
    "affiliateCommissionCents" INTEGER NOT NULL DEFAULT 0,
    "affiliateMarginRetainedCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "stripePaymentIntentId" TEXT,
    "trackingCarrier" TEXT,
    "trackingNumber" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveryConfirmedAt" TIMESTAMP(3),
    "deliveryConfirmedBy" TEXT,
    "payoutEligibleAt" TIMESTAMP(3),
    "supplierPayoutAt" TIMESTAMP(3),
    "affiliatePayoutAt" TIMESTAMP(3),
    "lastFulfillError" TEXT,
    "inngestRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlindDropshipOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlindDropshipOrderItem" (
    "id" TEXT NOT NULL,
    "blindDropshipOrderId" TEXT NOT NULL,
    "affiliateProductId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "blindDropshipSupplierId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "supplierPriceAtOrderCents" INTEGER NOT NULL,
    "supplierSkuAtOrder" TEXT NOT NULL,
    "linePaidCents" INTEGER NOT NULL DEFAULT 0,
    "marginCents" INTEGER NOT NULL DEFAULT 0,
    "affisellFeeCents" INTEGER NOT NULL DEFAULT 0,
    "affiliateCommissionCents" INTEGER NOT NULL DEFAULT 0,
    "affiliateMarginRetainedCents" INTEGER NOT NULL DEFAULT 0,
    "supplierOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlindDropshipOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SupplierIntegration_userId_idx" ON "SupplierIntegration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierIntegration_userId_platform_name_key" ON "SupplierIntegration"("userId", "platform", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Store_userId_key" ON "Store"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Store_customDomain_key" ON "Store"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "CategoryAttribute_categoryId_idx" ON "CategoryAttribute"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttribute_categoryId_key_key" ON "CategoryAttribute"("categoryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Subcategory_categoryId_slug_key" ON "Subcategory"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_supplierId_isDraft_idx" ON "Product"("supplierId", "isDraft");

-- CreateIndex
CREATE INDEX "Product_style_idx" ON "Product"("style");

-- CreateIndex
CREATE INDEX "Product_shippingType_idx" ON "Product"("shippingType");

-- CreateIndex
CREATE INDEX "Product_basePriceCents_idx" ON "Product"("basePriceCents");

-- CreateIndex
CREATE INDEX "Product_isOnSale_idx" ON "Product"("isOnSale");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_productId_idx" ON "ProductReview"("productId");

-- CreateIndex
CREATE INDEX "ProductReview_createdAt_idx" ON "ProductReview"("createdAt");

-- CreateIndex
CREATE INDEX "ProductAttribute_productId_idx" ON "ProductAttribute"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_productId_key_key" ON "ProductAttribute"("productId", "key");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Wishlist_userId_updatedAt_idx" ON "Wishlist"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Wishlist_productId_updatedAt_idx" ON "Wishlist"("productId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist"("userId", "productId");

-- CreateIndex
CREATE INDEX "SearchHistory_userId_createdAt_idx" ON "SearchHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchHistory_sessionId_createdAt_idx" ON "SearchHistory"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AffisellTrackEvent_productId_createdAt_idx" ON "AffisellTrackEvent"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "AffisellTrackEvent_eventType_createdAt_idx" ON "AffisellTrackEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AffisellTrackEvent_sessionId_createdAt_idx" ON "AffisellTrackEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_userId_storeId_key" ON "Follow"("userId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProduct_affiliateId_productId_key" ON "AffiliateProduct"("affiliateId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProduct_affiliateId_customSlug_key" ON "AffiliateProduct"("affiliateId", "customSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_affiliateProductId_variantSignature_key" ON "CartItem"("cartId", "affiliateProductId", "variantSignature");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerRewardLedger_idempotencyKey_key" ON "BuyerRewardLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BuyerRewardLedger_userId_createdAt_idx" ON "BuyerRewardLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BuyerRewardLedger_orderId_idx" ON "BuyerRewardLedger"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantPayoutLedger_idempotencyKey_key" ON "MerchantPayoutLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MerchantPayoutLedger_orderId_idx" ON "MerchantPayoutLedger"("orderId");

-- CreateIndex
CREATE INDEX "MerchantPayoutLedger_blindDropshipOrderId_idx" ON "MerchantPayoutLedger"("blindDropshipOrderId");

-- CreateIndex
CREATE INDEX "MerchantPayoutLedger_userId_createdAt_idx" ON "MerchantPayoutLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderReturn_orderId_idx" ON "OrderReturn"("orderId");

-- CreateIndex
CREATE INDEX "OrderReturn_status_idx" ON "OrderReturn"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "BlindDropshipSupplier_linkedUserId_key" ON "BlindDropshipSupplier"("linkedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BlindDropshipOrder_stripePaymentIntentId_key" ON "BlindDropshipOrder"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "BlindDropshipOrder_affiliateId_status_idx" ON "BlindDropshipOrder"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "BlindDropshipOrder_status_createdAt_idx" ON "BlindDropshipOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BlindDropshipOrderItem_blindDropshipOrderId_idx" ON "BlindDropshipOrderItem"("blindDropshipOrderId");

-- CreateIndex
CREATE INDEX "BlindDropshipOrderItem_supplierOrderId_idx" ON "BlindDropshipOrderItem"("supplierOrderId");

-- AddForeignKey
ALTER TABLE "SupplierIntegration" ADD CONSTRAINT "SupplierIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProduct" ADD CONSTRAINT "AffiliateProduct_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProduct" ADD CONSTRAINT "AffiliateProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_affiliateProductId_fkey" FOREIGN KEY ("affiliateProductId") REFERENCES "AffiliateProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerRewardLedger" ADD CONSTRAINT "BuyerRewardLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerRewardLedger" ADD CONSTRAINT "BuyerRewardLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPayoutLedger" ADD CONSTRAINT "MerchantPayoutLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPayoutLedger" ADD CONSTRAINT "MerchantPayoutLedger_blindDropshipOrderId_fkey" FOREIGN KEY ("blindDropshipOrderId") REFERENCES "BlindDropshipOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPayoutLedger" ADD CONSTRAINT "MerchantPayoutLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindDropshipSupplier" ADD CONSTRAINT "BlindDropshipSupplier_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindDropshipOrder" ADD CONSTRAINT "BlindDropshipOrder_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindDropshipOrder" ADD CONSTRAINT "BlindDropshipOrder_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindDropshipOrderItem" ADD CONSTRAINT "BlindDropshipOrderItem_blindDropshipOrderId_fkey" FOREIGN KEY ("blindDropshipOrderId") REFERENCES "BlindDropshipOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindDropshipOrderItem" ADD CONSTRAINT "BlindDropshipOrderItem_affiliateProductId_fkey" FOREIGN KEY ("affiliateProductId") REFERENCES "AffiliateProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindDropshipOrderItem" ADD CONSTRAINT "BlindDropshipOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindDropshipOrderItem" ADD CONSTRAINT "BlindDropshipOrderItem_blindDropshipSupplierId_fkey" FOREIGN KEY ("blindDropshipSupplierId") REFERENCES "BlindDropshipSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

