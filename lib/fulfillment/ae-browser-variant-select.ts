import type { VariantMappingRecord } from "@/lib/sku/variant-mapping"

export type AeVariantBrowserPage = {
  goto(url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" }): Promise<unknown>
  locator(selector: string): {
    first(): {
      click(options?: { timeout?: number }): Promise<void>
      isVisible(options?: { timeout?: number }): Promise<boolean>
    }
  }
  waitForLoadState?(
    state: "load" | "domcontentloaded" | "networkidle",
    options?: { timeout?: number }
  ): Promise<void>
}

/** CSS/text selectors for one AE variant value (title attribute or sku property chip). */
export function aeVariantValueSelector(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `[title="${escaped}"], .sku-property-item:has-text("${escaped}")`
}

/**
 * Clicks each variant chip on an AliExpress product page (manual mapping).
 * Uses Playwright when available in the worker runtime.
 */
export async function clickAeVariantMappingOnPage(
  page: AeVariantBrowserPage,
  supplierUrl: string,
  mapping: VariantMappingRecord
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supplierUrl.trim()) {
    return { ok: false, error: "MISSING_SUPPLIER_URL" }
  }
  const entries = Object.entries(mapping).filter(([, v]) => v.trim())
  if (entries.length === 0) {
    return { ok: true }
  }

  try {
    await page.goto(supplierUrl, { waitUntil: "domcontentloaded" })

    for (const [key, value] of entries) {
      const selector = aeVariantValueSelector(value)
      const loc = page.locator(selector).first()
      const visible = await loc.isVisible({ timeout: 12_000 }).catch(() => false)
      if (!visible) {
        console.log("[auto-buy] variant chip not found", { key, value, selector })
        return { ok: false, error: `AE_VARIANT_NOT_FOUND:${key}=${value}` }
      }
      await loc.click({ timeout: 12_000 })
      if (page.waitForLoadState) {
        await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {})
      }
      console.log("[auto-buy] variant selected", { key, value })
    }

    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[auto-buy] variant click failed", { supplierUrl, error: msg })
    return { ok: false, error: `AE_VARIANT_CLICK_FAILED:${msg}` }
  }
}

/** Launch Chromium via Playwright (worker / Docker). */
export async function launchAeBrowserPage(): Promise<
  | { ok: true; page: AeVariantBrowserPage; close: () => Promise<void> }
  | { ok: false; error: string }
> {
  try {
    const pw = await import("playwright")
    const browser = await pw.chromium.launch({
      headless: process.env.AE_BROWSER_HEADLESS !== "false",
    })
    const context = await browser.newContext()
    const page = await context.newPage()
    return {
      ok: true,
      page: page as unknown as AeVariantBrowserPage,
      close: async () => {
        await context.close().catch(() => {})
        await browser.close().catch(() => {})
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `PLAYWRIGHT_UNAVAILABLE:${msg}` }
  }
}
