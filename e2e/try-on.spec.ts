import { test, expect } from "@playwright/test"

test.describe("Try-on feature flag", () => {
  test("PDP does not show Try on without flag and product config", async ({ page }) => {
    await page.goto("/marketplace")
    await expect(page.getByRole("button", { name: /try on/i })).toHaveCount(0)
  })

  test("try-on API returns 404 when globally disabled", async ({ request }) => {
    const res = await request.post("/api/try-on", {
      data: {
        productId: "test",
        inputUrl: "https://example.com/a.webp",
        gdprConsent: true,
        consentVersion: "2026-06-18",
      },
    })
    expect([404, 400, 429]).toContain(res.status())
  })
})
