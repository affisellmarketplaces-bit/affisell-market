/**
 * The price of an AliExpress SKU IN EUROS — never a number in another currency read as euros (pure, shared by every
 * parser of `aliexpress.ds.product.get`).
 *
 * The call asks `target_currency: "EUR"`, but the SKU DTO also carries the seller's own `currency_code` next to
 * `offer_sale_price` / `sku_price`, which can be USD or CNY. Order of trust:
 *   1. the SKU's `target_*` price (the requested target currency, EUR);
 *   2. the SKU's own price when the answer says it is in EUR, or says nothing (legacy shape kept); explicitly in
 *      ANOTHER currency → 0 = unknown (never the product-level price: that is the cheapest SKU, it would understate a
 *      variant's cost). The auto-buy margin floor then refuses the purchase as "cost unknown" instead of reasoning on
 *      a dollar amount taken for euros;
 *   3. only when the SKU carries no price at all: the product-level price, under the same currency rule.
 */
function pick(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!obj) return ""
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function amount(raw: string): number {
  const n = Number(String(raw).replace(/[^\d.,]/g, "").replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function aliexpressSkuPriceEur(sku: Record<string, unknown>, result: Record<string, unknown>): number {
  // 1. The SKU's own price in the requested target currency (EUR).
  const skuTarget = amount(pick(sku, ["target_offer_sale_price", "target_sku_price"]))
  if (skuTarget > 0) return skuTarget
  // 2. The SKU's own price, in the currency the answer names for it (the SKU's, else the product's).
  const resultCurrency = pick(result, ["currency_code", "currency"]).toUpperCase()
  const skuCurrency = pick(sku, ["currency_code", "currency"]).toUpperCase() || resultCurrency
  const skuOwn = amount(pick(sku, ["offer_sale_price", "sku_price", "sale_price", "price"]))
  if (skuOwn > 0) return skuCurrency && skuCurrency !== "EUR" ? 0 : skuOwn
  // 3. No price on the SKU at all: the product-level price (target currency first).
  const resultTarget = amount(pick(result, ["target_sale_price"]))
  if (resultTarget > 0) return resultTarget
  const resultOwn = amount(pick(result, ["sale_price", "product_price"]))
  return resultCurrency && resultCurrency !== "EUR" ? 0 : resultOwn
}
