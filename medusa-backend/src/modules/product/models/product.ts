/**
 * Medusa v2 extends Product via a linked module — not by editing core Product.
 * Implementation: `src/modules/product-try-on/models/product-try-on.ts`
 *
 * Equivalent fields:
 * - try_on_enabled  → model.boolean().default(false)
 * - tryon_garment_url → model.text().nullable()
 *
 * Generate migrations: npx medusa db:generate productTryOnModule
 * Apply: npx medusa db:migrate
 */
export {}
