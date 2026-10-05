-- Guest favourites keep the price intent (target + baseline) so a price alert survives sign-up. Additive only.
ALTER TABLE "GuestWishlist" ADD COLUMN IF NOT EXISTS "targetPriceCents" INTEGER;
ALTER TABLE "GuestWishlist" ADD COLUMN IF NOT EXISTS "previousPriceCents" INTEGER;
