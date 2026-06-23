import { model } from "@medusajs/framework/utils"

/**
 * Virtual Try-On extension linked 1:1 to core Product (Medusa v2 module link).
 * Columns mirror Affisell Prisma `Product.tryOnEnabled` / `tryOnGarmentUrl`.
 */
export const ProductTryOn = model
  .define("product_try_on", {
    id: model.id().primaryKey(),
    try_on_enabled: model.boolean().default(false),
    tryon_garment_url: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_product_try_on_enabled",
      on: ["try_on_enabled"],
      where: "deleted_at IS NULL",
    },
  ])

export default ProductTryOn
