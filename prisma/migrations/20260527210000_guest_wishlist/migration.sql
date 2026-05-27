-- Guest wishlist (likes without customer account)

CREATE TABLE "GuestWishlist" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestWishlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestWishlist_guestId_productId_key" ON "GuestWishlist"("guestId", "productId");
CREATE INDEX "GuestWishlist_productId_idx" ON "GuestWishlist"("productId");
CREATE INDEX "GuestWishlist_guestId_updatedAt_idx" ON "GuestWishlist"("guestId", "updatedAt");

ALTER TABLE "GuestWishlist" ADD CONSTRAINT "GuestWishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
