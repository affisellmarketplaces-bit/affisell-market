import { describe, expect, it } from "vitest"

import { aliexpressSkuPriceEur } from "@/lib/aliexpress-price-eur"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"

describe("aliexpressSkuPriceEur — never a foreign-currency amount read as euros", () => {
  it("prefers the target-currency (EUR) price over the seller's own price", () => {
    expect(aliexpressSkuPriceEur({ offer_sale_price: "5.00", currency_code: "USD", target_offer_sale_price: "4.62" }, {})).toBe(4.62)
    // A SKU priced in CNY does not borrow the product-level EUR price (the cheapest SKU's): unknown.
    expect(aliexpressSkuPriceEur({ sku_price: "36.00", currency_code: "CNY" }, { target_sale_price: "4.70" })).toBe(0)
    // A SKU with no price at all falls back to the product-level target price.
    expect(aliexpressSkuPriceEur({ sku_id: "1" }, { target_sale_price: "4.70" })).toBe(4.7)
  })

  it("a price explicitly in another currency, with no EUR price, is UNKNOWN (0), not euros", () => {
    expect(aliexpressSkuPriceEur({ offer_sale_price: "5.00", currency_code: "USD" }, {})).toBe(0)
    expect(aliexpressSkuPriceEur({ sku_price: "36" }, { currency_code: "CNY", sale_price: "36" })).toBe(0)
  })

  it("an EUR or unlabelled price keeps the legacy behaviour", () => {
    expect(aliexpressSkuPriceEur({ offer_sale_price: "6.09", currency_code: "EUR" }, {})).toBe(6.09)
    expect(aliexpressSkuPriceEur({ offer_sale_price: "6,09" }, {})).toBe(6.09)
    expect(aliexpressSkuPriceEur({}, { sale_price: "12.5" })).toBe(12.5)
    // Multi-SKU product: each SKU keeps ITS price, the product-level target price does not overwrite it.
    expect(aliexpressSkuPriceEur({ offer_sale_price: "8.10" }, { target_sale_price: "4.99" })).toBe(8.1)
    expect(aliexpressSkuPriceEur({ offer_sale_price: "0" }, {})).toBe(0)
  })

  it("the product mapper refuses a product whose only prices are in USD instead of storing dollars as euros", () => {
    const payload = {
      aliexpress_ds_product_get_response: {
        result: {
          ae_item_base_info_dto: { product_id: 1005001, subject: "Test" },
          ae_item_sku_info_dtos: { ae_item_sku_info_d_t_o: [{ sku_id: "1", offer_sale_price: "5.00", currency_code: "USD", sku_available_stock: 3 }] },
        },
      },
    }
    expect(() => mapAliExpressGetProductResponse(payload as never, "1005001")).toThrow(/price not found/)
  })
})
