/**
 * Idempotent ensure of Affisell AutoBuy platform supplier (ops / deploy).
 * Usage: npx tsx scripts/ensure-autobuy-supplier.ts
 */
import { ensureAffisellAutoBuySupplier } from "../lib/auto-buy-platform-supplier"

async function main() {
  const supplier = await ensureAffisellAutoBuySupplier()
  console.log("[ensure-autobuy-supplier]", {
    ok: true,
    supplierId: supplier.id,
    email: supplier.email,
    storeSlug: supplier.storeSlug,
    created: supplier.created,
  })
}

main().catch((err) => {
  console.error("[ensure-autobuy-supplier]", err)
  process.exit(1)
})
