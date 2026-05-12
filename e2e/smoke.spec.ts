import { expect, test } from "@playwright/test"

test.describe.configure({ mode: "serial" })

test.describe("smoke", () => {
  test("home shows hero and marketplace entry", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Affisell", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: /Browse marketplace/i })).toBeVisible()
  })

  test("home → marketplace via CTA", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /Browse marketplace/i }).click()
    await expect(page).toHaveURL(/\/marketplace/)
    await expect(page.getByRole("heading", { level: 1, name: "Marketplace" })).toBeVisible()
  })

  test("header exposes Cart from marketplace", async ({ page }) => {
    await page.goto("/marketplace")
    await expect(page.getByRole("link", { name: /^Cart$/ })).toBeVisible()
    await page.getByRole("link", { name: /^Cart$/ }).click()
    await expect(page).toHaveURL(/\/cart/)
  })
})
