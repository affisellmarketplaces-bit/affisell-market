import {
  fetchHtmlWithScrapingBee,
  getScrapingBeeApiKey,
  normalizeImportUrl,
} from "@/lib/import-url-scrape"

const FETCH_TIMEOUT_MS = 25_000

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

export type AePageHtmlResult =
  | { ok: true; html: string; source: "scrapingbee" | "direct" }
  | { ok: false; error: string }

/** Fetch AliExpress product page HTML (ScrapingBee if configured, else direct). */
export async function fetchAliExpressProductHtml(aeUrl: string): Promise<AePageHtmlResult> {
  const url = normalizeImportUrl(aeUrl.trim(), "aliexpress")
  const apiKey = getScrapingBeeApiKey()

  if (apiKey) {
    try {
      const { html, strategy } = await fetchHtmlWithScrapingBee(url, "aliexpress", apiKey)
      console.log("[ae-page-fetch]", { url, source: "scrapingbee", strategy, bytes: html.length })
      return { ok: true, html, source: "scrapingbee" }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log("[ae-page-fetch]", { url, source: "scrapingbee", error: msg })
    }
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    })
    const html = await res.text()
    if (!res.ok || html.length < 500) {
      return {
        ok: false,
        error: apiKey
          ? "Page AE inaccessible — vérifiez l’URL ou les crédits ScrapingBee."
          : "Page AE inaccessible — utilisez Import Express (favori navigateur).",
      }
    }
    console.log("[ae-page-fetch]", { url, source: "direct", bytes: html.length })
    return { ok: true, html, source: "direct" }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: apiKey
        ? `Fetch AE échoué : ${msg}`
        : `Fetch AE échoué : ${msg}. Utilisez Import Express depuis l’admin.`,
    }
  }
}
