-- Alternative commerce: refurbished, second-hand, wholesale-only, donation

ALTER TABLE "Product" ADD COLUMN "offerMode" TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Product" ADD COLUMN "minOrderQuantity" INTEGER NOT NULL DEFAULT 1;

UPDATE "Product" SET "offerMode" = 'REFURBISHED' WHERE "isRefurbished" = true;

CREATE INDEX "Product_offerMode_idx" ON "Product"("offerMode");
