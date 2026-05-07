/**
 * Seed Amazon-style attribute schemas for key leaf categories.
 *
 * IMPORTANT: This repo uses globally-unique leaf slugs:
 *   `${parentSlug}-${slugify(subName)}`
 *
 * Run:
 *   npx tsx prisma/seed-attributes-complete.ts
 */

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const ATTRIBUTE_SCHEMAS: Record<string, any[]> = {
  // ELECTRONICS
  "electronics-cell-phones-accessories": [
    { key: "brand", label: "Brand", type: "text", required: true, order: 1 },
    { key: "model_name", label: "Model Name", type: "text", required: true, order: 2 },
    {
      key: "operating_system",
      label: "Operating System",
      type: "select",
      options: ["iOS", "Android", "Other"],
      required: true,
      order: 3,
    },
    { key: "screen_size", label: "Screen Size", type: "number", unit: "inches", required: true, order: 4 },
    {
      key: "storage_capacity",
      label: "Storage Capacity",
      type: "select",
      options: ["64GB", "128GB", "256GB", "512GB", "1TB"],
      required: true,
      order: 5,
    },
    { key: "ram", label: "RAM", type: "select", options: ["4GB", "6GB", "8GB", "12GB", "16GB"], unit: "GB", order: 6 },
    { key: "color", label: "Color", type: "text", required: true, order: 7 },
    {
      key: "connectivity",
      label: "Connectivity Technology",
      type: "multiselect",
      options: ["5G", "4G", "Wi-Fi", "Bluetooth", "NFC", "GPS"],
      order: 8,
    },
    { key: "battery_capacity", label: "Battery Capacity", type: "number", unit: "mAh", order: 9 },
    { key: "camera_resolution", label: "Rear Camera", type: "text", unit: "MP", order: 10 },
    { key: "item_weight", label: "Item Weight", type: "number", unit: "grams", order: 11 },
  ],
  "electronics-computers-tablets": [
    { key: "brand", label: "Brand", type: "text", required: true, order: 1 },
    { key: "model_name", label: "Model Name", type: "text", required: true, order: 2 },
    { key: "processor", label: "Processor", type: "text", required: true, order: 3 },
    { key: "processor_speed", label: "Processor Speed", type: "number", unit: "GHz", order: 4 },
    {
      key: "ram",
      label: "RAM",
      type: "select",
      options: ["8GB", "16GB", "32GB", "64GB", "128GB"],
      required: true,
      order: 5,
    },
    { key: "storage", label: "Hard Drive", type: "text", required: true, order: 6 },
    { key: "screen_size", label: "Screen Size", type: "number", unit: "inches", order: 7 },
    { key: "resolution", label: "Screen Resolution", type: "text", order: 8 },
    { key: "graphics", label: "Graphics Coprocessor", type: "text", order: 9 },
    { key: "os", label: "Operating System", type: "select", options: ["Windows", "macOS", "Linux", "ChromeOS"], order: 10 },
    { key: "item_weight", label: "Item Weight", type: "number", unit: "kg", order: 11 },
  ],
  "electronics-audio-headphones": [
    { key: "brand", label: "Brand", type: "text", required: true, order: 1 },
    { key: "model_name", label: "Model Name", type: "text", order: 2 },
    {
      key: "connectivity_technology",
      label: "Connectivity Technology",
      type: "select",
      options: ["Bluetooth", "Wired", "Wi-Fi", "NFC"],
      required: true,
      order: 3,
    },
    { key: "form_factor", label: "Form Factor", type: "select", options: ["Over-Ear", "On-Ear", "In-Ear", "Earbuds"], order: 4 },
    { key: "noise_control", label: "Noise Control", type: "select", options: ["Active Noise Cancellation", "Passive", "None"], order: 5 },
    { key: "battery_life", label: "Battery Life", type: "number", unit: "hours", order: 6 },
    { key: "color", label: "Color", type: "text", order: 7 },
  ],

  // BEAUTY
  "beauty-makeup": [
    { key: "brand", label: "Brand", type: "text", required: true, order: 1 },
    { key: "color", label: "Color/Shade", type: "text", required: true, order: 2 },
    { key: "finish", label: "Finish", type: "select", options: ["Matte", "Glossy", "Satin", "Metallic", "Shimmer"], order: 3 },
    { key: "skin_type", label: "Skin Type", type: "multiselect", options: ["All", "Dry", "Oily", "Sensitive", "Combination", "Normal"], order: 4 },
    { key: "volume", label: "Item Volume", type: "number", unit: "ml", order: 5 },
    { key: "special_feature", label: "Special Feature", type: "text", order: 6 },
  ],
  "beauty-skin-care": [
    { key: "brand", label: "Brand", type: "text", required: true, order: 1 },
    {
      key: "skin_type",
      label: "Skin Type",
      type: "multiselect",
      options: ["All", "Dry", "Oily", "Sensitive", "Acne-Prone", "Aging", "Normal"],
      required: true,
      order: 2,
    },
    {
      key: "product_benefits",
      label: "Product Benefits",
      type: "multiselect",
      options: ["Hydrating", "Anti-Aging", "Brightening", "Acne Treatment", "Sun Protection"],
      order: 3,
    },
    { key: "key_ingredients", label: "Key Ingredients", type: "text", order: 4 },
    { key: "volume", label: "Item Volume", type: "number", unit: "ml", order: 5 },
    { key: "spf", label: "SPF", type: "number", order: 6 },
  ],

  // HOME
  "home-kitchen-furniture": [
    { key: "brand", label: "Brand", type: "text", order: 1 },
    { key: "material", label: "Material", type: "text", required: true, order: 2 },
    { key: "color", label: "Color", type: "text", required: true, order: 3 },
    { key: "dimensions", label: "Product Dimensions", type: "text", unit: "LxWxH cm", order: 4 },
    { key: "item_weight", label: "Item Weight", type: "number", unit: "kg", order: 5 },
    { key: "assembly_required", label: "Assembly Required", type: "boolean", order: 6 },
    { key: "room_type", label: "Room Type", type: "multiselect", options: ["Living Room", "Bedroom", "Kitchen", "Office", "Outdoor"], order: 7 },
  ],
  "home-kitchen-kitchen-dining": [
    { key: "brand", label: "Brand", type: "text", required: true, order: 1 },
    { key: "material", label: "Material", type: "text", required: true, order: 2 },
    { key: "capacity", label: "Capacity", type: "number", unit: "liters", order: 3 },
    { key: "color", label: "Color", type: "text", order: 4 },
    { key: "dishwasher_safe", label: "Dishwasher Safe", type: "boolean", order: 5 },
    { key: "item_weight", label: "Item Weight", type: "number", unit: "kg", order: 6 },
  ],
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL missing")
    process.exit(1)
  }

  for (const [slug, attrs] of Object.entries(ATTRIBUTE_SCHEMAS)) {
    const category = await prisma.category.findUnique({ where: { slug } })
    if (!category) {
      console.log(`⚠️ Category ${slug} not found`)
      continue
    }

    for (const attr of attrs) {
      await prisma.categoryAttribute.upsert({
        where: { categoryId_key: { categoryId: category.id, key: String(attr.key) } },
        update: {
          label: String(attr.label ?? attr.key),
          type: String(attr.type ?? "text"),
          unit: attr.unit ? String(attr.unit) : null,
          options: Array.isArray(attr.options) ? attr.options.map(String) : [],
          required: Boolean(attr.required),
          order: typeof attr.order === "number" ? attr.order : 0,
          aiSuggest: true,
          showInFilter: true,
        },
        create: {
          categoryId: category.id,
          key: String(attr.key),
          label: String(attr.label ?? attr.key),
          type: String(attr.type ?? "text"),
          unit: attr.unit ? String(attr.unit) : null,
          options: Array.isArray(attr.options) ? attr.options.map(String) : [],
          required: Boolean(attr.required),
          order: typeof attr.order === "number" ? attr.order : 0,
          aiSuggest: true,
          showInFilter: true,
        },
      })
    }
    console.log(`✅ Attributes seeded for ${slug}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

