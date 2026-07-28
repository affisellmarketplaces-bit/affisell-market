import { afterEach, describe, expect, it, vi } from "vitest"

import { scrapeSupplierProductFromUrl } from "@/lib/supplier-import-url-handler"

const AMAZON_HTML = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Anneau d'or pour femme avec 8 symboles ajustable : Amazon.fr: Mode</title>
  </head>
  <body>
    <span id="productTitle"> Anneau d'or pour femme avec 8 symboles ajustable </span>
    <a id="bylineInfo">Marque : HTEJFUXQE</a>
    <div id="corePrice_desktop">Prix : EUR 12,34</div>
    <div id="feature-bullets">
      <ul>
        <li><span class="a-list-item">Acier inoxydable hypoallergenique</span></li>
        <li><span class="a-list-item">8 symboles ajustes avec finition polie</span></li>
      </ul>
    </div>
    <table id="productDetails_techSpec_section_1">
      <tr><th>Marque</th><td>HTEJFUXQE</td></tr>
      <tr><th>Couleur</th><td>Gold</td></tr>
      <tr><th>Materiau</th><td>Acier inoxydable</td></tr>
      <tr><th>Taille</th><td>Ajustable</td></tr>
    </table>
    <input type="hidden" id="ASIN" value="B0TEST1234" />
    <script>
      P.when('A').register("ImageBlockATF", function(A){
        var data = {
          'colorImages': { 'initial': [
            {"hiRes":"https://m.media-amazon.com/images/I/51-main._AC_SL1500_.jpg"},
            {"large":"https://m.media-amazon.com/images/I/41-alt._AC_SL1000_.jpg"}
          ] }
        };
      });
    </script>
  </body>
</html>
`

describe("scrapeSupplierProductFromUrl amazon direct fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("extracts complete Amazon data without ScrapingBee", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => AMAZON_HTML,
      }))
    )

    const result = await scrapeSupplierProductFromUrl({
      url: "https://www.amazon.fr/dp/B0TEST1234",
      options: { fast: true },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.method).toBe("direct")
    expect(result.warnings).toEqual([])
    expect(result.product.title).toContain("Anneau")
    expect(result.product.price).toBe(12.34)
    expect(result.product.images).toEqual([
      "https://m.media-amazon.com/images/I/51-main._AC_SL1500_.jpg",
      "https://m.media-amazon.com/images/I/41-alt._AC_SL1000_.jpg",
    ])
    expect(result.product.specs.Materiau).toBe("Acier inoxydable")
    expect(result.product.colors[0]?.name).toBe("Gold")
    expect(result.product.sizes[0]?.name).toBe("Ajustable")
    expect(result.product.sku).toBe("B0TEST1234")
  })
})
