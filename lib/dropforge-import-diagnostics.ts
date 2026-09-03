import { getAliExpressApiReadyStatus } from "@/lib/aliexpress-api-ready.server"
import { dropForgeIncompleteError } from "@/lib/dropforge-complete-import"
import { getScrapingBeeApiKey } from "@/lib/import-url-scrape"

/** Actionable hints for ops / suppliers when DropForge completeness gate fails. */
export async function dropForgeImportFailureHints(
  marketplaceLabel: string,
  opts?: { suggestBrowserBridge?: boolean }
): Promise<string[]> {
  const hints: string[] = []

  if (marketplaceLabel === "AliExpress") {
    const ae = await getAliExpressApiReadyStatus()
    if (!ae.configured) {
      hints.push(ae.message)
      hints.push(
        "Reconnecte l’API : GET /api/aliexpress/oauth/start puis tokens sur Vercel (ALIEXPRESS_REFRESH_TOKEN)."
      )
    } else if (ae.tokenSource === "db") {
      hints.push(
        ae.accountHint
          ? `Session OAuth active (${ae.accountHint}).`
          : "Session OAuth active en base chiffrée."
      )
    } else {
      hints.push("API AliExpress DS active — import via aliexpress.ds.product.get (api-sg).")
    }

    if (opts?.suggestBrowserBridge) {
      hints.push(
        "Utilise le pont Express Bridge ci-dessous : votre navigateur lit la page AliExpress (100 % fiable, sans ScrapingBee)."
      )
    } else if (!getScrapingBeeApiKey()) {
      hints.push(
        "Scrape serveur limité sans SCRAPINGBEE_API_KEY — préférez l’API AliExpress ou le pont navigateur."
      )
    }

    hints.push(
      "Colle l’URL canonique https://www.aliexpress.com/item/{id}.html ou un lien de tracking avec ID produit."
    )
    return hints
  }

  hints.push("Vérifie l’URL produit (page fiche, pas l’accueil du site).")
  if (!getScrapingBeeApiKey()) {
    hints.push("SCRAPINGBEE_API_KEY absente — configure-la sur Vercel pour les imports scrape non-AE.")
  }
  return hints
}

export async function dropForgeImportFailureMessage(
  marketplaceLabel: string,
  suggestBrowserBridge?: boolean
): Promise<string> {
  return dropForgeIncompleteError(
    marketplaceLabel,
    await dropForgeImportFailureHints(marketplaceLabel, {
      suggestBrowserBridge: suggestBrowserBridge === true,
    })
  )
}
