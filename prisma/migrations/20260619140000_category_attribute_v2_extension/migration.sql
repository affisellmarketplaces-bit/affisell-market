-- ÉTAPE 2 — Extension additive taxonomy + attributs globaux (no DROP)

-- CreateEnum
CREATE TYPE "AttributeValueType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT_SINGLE', 'SELECT_MULTI', 'UNIT_VALUE', 'TEXTAREA');

-- CreateEnum
CREATE TYPE "CategoryTemplateType" AS ENUM ('TITLE', 'DESC');

-- AlterTable Category (SEO + materialized path)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "pathIds" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "metaDesc" TEXT;

CREATE INDEX IF NOT EXISTS "Category_pathIds_idx" ON "Category"("pathIds");
CREATE INDEX IF NOT EXISTS "Category_parentId_order_idx" ON "Category"("parentId", "order");

-- CreateTable Attribute
CREATE TABLE IF NOT EXISTS "Attribute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "AttributeValueType" NOT NULL,
    "unit" TEXT,
    "validationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Attribute_slug_key" ON "Attribute"("slug");
CREATE INDEX IF NOT EXISTS "Attribute_type_idx" ON "Attribute"("type");

-- CreateTable AttributeOption
CREATE TABLE IF NOT EXISTS "AttributeOption" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "hexColor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttributeOption_attributeId_slug_key" ON "AttributeOption"("attributeId", "slug");
CREATE INDEX IF NOT EXISTS "AttributeOption_attributeId_sortOrder_idx" ON "AttributeOption"("attributeId", "sortOrder");

-- AlterTable CategoryAttribute
ALTER TABLE "CategoryAttribute" ADD COLUMN IF NOT EXISTS "attributeId" TEXT;
ALTER TABLE "CategoryAttribute" ADD COLUMN IF NOT EXISTS "isVariant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CategoryAttribute" ADD COLUMN IF NOT EXISTS "isFilterable" BOOLEAN;
ALTER TABLE "CategoryAttribute" ADD COLUMN IF NOT EXISTS "appliesToDescendants" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "CategoryAttribute_attributeId_idx" ON "CategoryAttribute"("attributeId");

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isVariantParent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable CategoryTemplate
CREATE TABLE IF NOT EXISTS "CategoryTemplate" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "templateType" "CategoryTemplateType" NOT NULL,
    "templateString" TEXT NOT NULL,

    CONSTRAINT "CategoryTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryTemplate_categoryId_templateType_key" ON "CategoryTemplate"("categoryId", "templateType");
CREATE INDEX IF NOT EXISTS "CategoryTemplate_categoryId_idx" ON "CategoryTemplate"("categoryId");

-- CreateTable VariantAttributeValue
CREATE TABLE IF NOT EXISTS "VariantAttributeValue" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,4),
    "valueBoolean" BOOLEAN,
    "optionId" TEXT,

    CONSTRAINT "VariantAttributeValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VariantAttributeValue_variantId_attributeId_key" ON "VariantAttributeValue"("variantId", "attributeId");
CREATE INDEX IF NOT EXISTS "VariantAttributeValue_attributeId_idx" ON "VariantAttributeValue"("attributeId");
CREATE INDEX IF NOT EXISTS "VariantAttributeValue_optionId_idx" ON "VariantAttributeValue"("optionId");

-- AddForeignKey
ALTER TABLE "AttributeOption" DROP CONSTRAINT IF EXISTS "AttributeOption_attributeId_fkey";
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CategoryAttribute" DROP CONSTRAINT IF EXISTS "CategoryAttribute_attributeId_fkey";
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CategoryTemplate" DROP CONSTRAINT IF EXISTS "CategoryTemplate_categoryId_fkey";
ALTER TABLE "CategoryTemplate" ADD CONSTRAINT "CategoryTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantAttributeValue" DROP CONSTRAINT IF EXISTS "VariantAttributeValue_variantId_fkey";
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantAttributeValue" DROP CONSTRAINT IF EXISTS "VariantAttributeValue_attributeId_fkey";
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantAttributeValue" DROP CONSTRAINT IF EXISTS "VariantAttributeValue_optionId_fkey";
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AttributeOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
