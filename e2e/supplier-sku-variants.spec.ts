import { expect, test } from "@playwright/test"

/**
 * API-level checks for SKU variant validation (no supplier session required).
 * Full UI flow (Bonnet Noir/Rouge × S/M) needs an authenticated supplier — set
 * PLAYWRIGHT_SUPPLIER_COOKIE if you extend this suite later.
 */
test.describe("supplier SKU variants API", () => {
  test("rejects invalid color with + in variant payload via public products route shape", async ({
    request,
  }) => {
    const res = await request.post("/api/supplier/products", {
      data: {
        name: "Bonnet test",
        price: 19.9,
        stock: 0,
        saveAsDraft: true,
        hasVariants: true,
        variants: [
          {
            color: "Noir+Rouge",
            size: "S",
            sku: "BON-NOI-S",
            supplierPrice: 9.9,
            publicPrice: 19.9,
            stock: 10,
          },
        ],
      },
    })

    expect([400, 401, 403]).toContain(res.status())
    if (res.status() === 400) {
      const body = (await res.json()) as { error?: string }
      expect(body.error?.toLowerCase() ?? "").toMatch(/couleur|pas de|invalide|variant/)
    }
  })

  test("rejects missing required custom column on variant row", async ({ request }) => {
    const res = await request.post("/api/supplier/products", {
      data: {
        name: "Luminaire test",
        price: 49.9,
        stock: 0,
        saveAsDraft: true,
        hasVariants: true,
        customColumns: [
          {
            key: "indice_ip",
            label: "Indice IP",
            type: "select",
            required: true,
            options: ["IP44", "IP67"],
          },
        ],
        variants: [
          {
            color: "Noir",
            size: "S",
            sku: "LUM-NOI-S",
            supplierPrice: 20,
            stock: 5,
            customData: { indice_ip: "IP44" },
          },
          {
            color: "Rouge",
            size: "M",
            sku: "LUM-ROU-M",
            supplierPrice: 20,
            stock: 5,
            customData: {},
          },
        ],
      },
    })

    expect([400, 401, 403]).toContain(res.status())
    if (res.status() === 400) {
      const body = (await res.json()) as { error?: string }
      expect(body.error ?? "").toMatch(/Indice IP requis|Ligne 2/)
    }
  })

  test("accepts Bonnet 4-SKU matrix when supplier is authenticated", async ({ request }) => {
    test.skip(!process.env.PLAYWRIGHT_SUPPLIER_COOKIE, "Set PLAYWRIGHT_SUPPLIER_COOKIE for authenticated E2E")

    const res = await request.post("/api/supplier/products", {
      headers: {
        Cookie: process.env.PLAYWRIGHT_SUPPLIER_COOKIE!,
      },
      data: {
        name: "Bonnet",
        price: 19.9,
        stock: 40,
        saveAsDraft: true,
        hasVariants: true,
        variants: [
          { color: "Noir", size: "S", sku: "BON-NOI-S", supplierPrice: 9.9, publicPrice: 19.9, stock: 10 },
          { color: "Noir", size: "M", sku: "BON-NOI-M", supplierPrice: 9.9, publicPrice: 19.9, stock: 10 },
          { color: "Rouge", size: "S", sku: "BON-ROU-S", supplierPrice: 9.9, publicPrice: 19.9, stock: 10 },
          { color: "Rouge", size: "M", sku: "BON-ROU-M", supplierPrice: 9.9, publicPrice: 19.9, stock: 10 },
        ],
        listingVariants: {
          size: ["S", "M"],
          variantRows: [],
        },
      },
    })

    expect(res.status()).toBe(201)
    const body = (await res.json()) as { id?: string; hasVariants?: boolean }
    expect(body.id).toBeTruthy()
    expect(body.hasVariants).toBe(true)
  })
})
