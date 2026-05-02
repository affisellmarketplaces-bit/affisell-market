-- Migrate legacy `image` (String) to `images` (String[]) when upgrading; no-op when already on `images`.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'image'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'images'
  ) THEN
    ALTER TABLE "Product" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
    UPDATE "Product" SET "images" = CASE
      WHEN "image" IS NOT NULL AND btrim("image") <> '' THEN ARRAY[btrim("image")]::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END;
    ALTER TABLE "Product" DROP COLUMN "image";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'images'
  ) THEN
    ALTER TABLE "Product" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;
