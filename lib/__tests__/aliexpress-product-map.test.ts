import { describe, expect, it } from "vitest"

import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { absolutizeCdnImageUrl, collectAbsolutizedImageUrls } from "@/lib/cdn-image-url"

describe("absolutizeCdnImageUrl", () => {
  it("turns protocol-relative AE CDN into https", () => {
    expect(absolutizeCdnImageUrl("//ae01.alicdn.com/kf/abc.jpg")).toBe(
      "https://ae01.alicdn.com/kf/abc.jpg"
    )
  })

  it("keeps absolute https", () => {
    expect(absolutizeCdnImageUrl("https://ae01.alicdn.com/kf/abc.jpg")).toBe(
      "https://ae01.alicdn.com/kf/abc.jpg"
    )
  })
})

describe("mapAliExpressGetProductResponse images + specs", () => {
  it("absolutizes gallery URLs and merges specs into description", () => {
    const mapped = mapAliExpressGetProductResponse(
      {
        aliexpress_ds_product_get_response: {
          result: {
            ae_item_base_info_dto: {
              subject: "Portable carpet cleaner 12KPa",
              detail: "<p>Nettoyeur 450W</p>",
            },
            ae_multimedia_info_dto: {
              image_urls: "//ae01.alicdn.com/kf/hero.jpg;//ae01.alicdn.com/kf/side.jpg",
            },
            ae_item_properties: {
              ae_item_property: [
                { attr_name: "Power", attr_value: "450W" },
                { attr_name: "Suction", attr_value: "12kPa" },
              ],
            },
            ae_item_sku_info_dtos: {
              ae_item_sku_info_d_t_o: [
                {
                  sku_id: "1200001",
                  offer_sale_price: "49.99",
                  sku_available_stock: 20,
                  sku_price: "49.99",
                },
              ],
            },
            target_sale_price: "49.99",
          },
        },
      },
      "1005012670002032"
    )

    expect(mapped.images.length).toBeGreaterThanOrEqual(2)
    expect(mapped.images.every((u) => u.startsWith("https://"))).toBe(true)
    expect(mapped.images[0]).toContain("alicdn.com")
    expect(mapped.specs.power).toBe("450W")
    expect(mapped.specs.suction).toBe("12kPa")
    expect(mapped.description).toMatch(/CARACTÉRISTIQUES/)
    expect(mapped.description).toMatch(/450W/)
    expect(mapped.basePriceCents).toBe(4999)
  })

  it("extracts HTML detail images without leaking [[img:N]] into description", () => {
    const mapped = mapAliExpressGetProductResponse(
      {
        aliexpress_ds_product_get_response: {
          result: {
            ae_item_base_info_dto: {
              subject: "Electric water gun",
              detail:
                '<p>Fun outdoor toy</p><img src="//ae01.alicdn.com/kf/d0.jpg"/><img src="https://ae01.alicdn.com/kf/d1.jpg"/>',
            },
            ae_multimedia_info_dto: {
              image_urls: "//ae01.alicdn.com/kf/hero.jpg",
            },
            ae_item_sku_info_dtos: {
              ae_item_sku_info_d_t_o: [
                {
                  sku_id: "1",
                  offer_sale_price: "18.73",
                  sku_available_stock: 50,
                  sku_price: "18.73",
                },
              ],
            },
            target_sale_price: "18.73",
          },
        },
      },
      "1005011995562037"
    )

    expect(mapped.description).not.toMatch(/\[\[\s*img\s*:/i)
    expect(mapped.description).toMatch(/Fun outdoor toy/)
    expect(mapped.descriptionIllustrationImages.length).toBeGreaterThanOrEqual(2)
    expect(mapped.images.some((u) => u.includes("d0.jpg"))).toBe(true)
  })
})
