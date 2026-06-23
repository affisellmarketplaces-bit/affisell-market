import { z } from "@medusajs/framework/zod"

import { isAllowedTryOnGarmentUrl, isTryOnImageExtension } from "../../lib/try-on-url-validator"

const garmentUrlSchema = z
  .string()
  .url()
  .refine((url) => isAllowedTryOnGarmentUrl(url), {
    message: "garment URL must be HTTPS on Vercel Blob or Cloudinary",
  })
  .refine((url) => isTryOnImageExtension(url), {
    message: "garment URL must be PNG, JPG, or WebP",
  })

/** Additional data on POST /admin/products */
export const AdminPostProductsTryOnSchema = z.object({
  try_on_enabled: z.boolean().optional(),
  tryon_garment_url: garmentUrlSchema.nullable().optional(),
})

/** Additional data on POST /admin/products/:id */
export const AdminPostProductsProductTryOnSchema = AdminPostProductsTryOnSchema

export type AdminPostProductsTryOnInput = z.infer<typeof AdminPostProductsTryOnSchema>

export const tryOnAdditionalDataValidator = {
  try_on_enabled: z.boolean().optional(),
  tryon_garment_url: garmentUrlSchema.nullable().optional(),
}
