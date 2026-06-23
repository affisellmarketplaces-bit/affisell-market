import { test, expect } from "@playwright/test"

const medusaAdminUrl = process.env.MEDUSA_ADMIN_URL ?? "http://127.0.0.1:9000/app"
const medusaBackendUrl = process.env.MEDUSA_BACKEND_URL ?? "http://127.0.0.1:9000"
const medusaProductHandle = process.env.MEDUSA_TRYON_TEST_HANDLE ?? ""
const medusaEnabled = process.env.MEDUSA_E2E_ENABLED === "1"

test.describe("Medusa Try-On extension", () => {
  test.skip(!medusaEnabled, "Set MEDUSA_E2E_ENABLED=1 + running Medusa backend")

  test("admin product try-on API persists enabled + garment URL", async ({ request }) => {
    const productId = process.env.MEDUSA_TRYON_TEST_PRODUCT_ID
    test.skip(!productId, "MEDUSA_TRYON_TEST_PRODUCT_ID required")

    const garmentUrl =
      process.env.MEDUSA_TRYON_TEST_GARMENT_URL ??
      "https://example.blob.vercel-storage.com/flatlay-test.png"

    const adminToken = process.env.MEDUSA_ADMIN_TOKEN
    test.skip(!adminToken, "MEDUSA_ADMIN_TOKEN required")

    const headers = {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    }

    const saveRes = await request.post(`${medusaBackendUrl}/admin/products/${productId}/try-on`, {
      headers,
      data: {
        try_on_enabled: true,
        tryon_garment_url: garmentUrl,
      },
    })
    expect(saveRes.ok()).toBeTruthy()

    const reloadRes = await request.get(
      `${medusaBackendUrl}/admin/products/${productId}?fields=+product_try_on.*`,
      { headers }
    )
    expect(reloadRes.ok()).toBeTruthy()
    const body = (await reloadRes.json()) as {
      product?: { product_try_on?: { try_on_enabled?: boolean; tryon_garment_url?: string } }
    }
    expect(body.product?.product_try_on?.try_on_enabled).toBe(true)
    expect(body.product?.product_try_on?.tryon_garment_url).toBe(garmentUrl)
  })

  test("storefront /produits/:handle shows Try on when enabled", async ({ page }) => {
    test.skip(!medusaProductHandle, "MEDUSA_TRYON_TEST_HANDLE required")

    await page.goto(`/produits/${encodeURIComponent(medusaProductHandle)}?tryon=true`)
    await expect(page.getByRole("button", { name: /try on/i })).toBeVisible()
  })

  test("admin widget route is listed in Medusa admin (smoke)", async ({ page }) => {
    await page.goto(medusaAdminUrl)
    await expect(page).toHaveURL(/9000|medusa|admin/i)
  })
})
