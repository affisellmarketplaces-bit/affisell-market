import type { AeVariantBrowserPage } from "@/lib/fulfillment/ae-browser-variant-select"

/** Launch Chromium via Playwright (worker / Docker only — optional dep). */
export async function launchAeBrowserPage(): Promise<
  | { ok: true; page: AeVariantBrowserPage; close: () => Promise<void> }
  | { ok: false; error: string }
> {
  try {
    const pw = await import(/* webpackIgnore: true */ "playwright")
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
