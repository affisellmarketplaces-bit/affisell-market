/** Client-safe query keys — no Prisma (import from here in `"use client"` modules). */

export const MARKETPLACE_QUERY_RESERVED = new Set([
  "categoryId",
  "category",
  "subcategoryId",
  "subcategory",
  "q",
  "shipsFrom",
  "delivery",
  "freeShipping",
  "price",
  "dept",
])

/** Reserved prefix for product SKU custom column filters (`cc_matiere=…`) */
export const MARKETPLACE_CUSTOM_COLUMN_PREFIX = "cc_"
