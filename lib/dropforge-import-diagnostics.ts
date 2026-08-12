import { getAliExpressConfigStatus } from "@/lib/aliexpress-config"
import { dropForgeIncompleteError } from "@/lib/dropforge-complete-import"
import { getScrapingBeeApiKey } from "@/lib/import-url-scrape"

/** Actionable hints for ops / suppliers when DropForge completeness gate fails. */
export function dropForgeImportFailureHints(marketplaceLabel: string): string[] {
  const hints: string[] = []

  if (marketplaceLabel === "AliExpress") {
    const ae = getAliExpressConfigStatus()
    if (!ae.configured) {
      hints.push(ae.message)
    }
    if (!getScrapingBeeApiKey()) {
      hints.push(
        "SCRAPINGBEE_API_KEY absente — le scrape AliExpress de secours est indisponible."
      )
    }
    hints.push(
      "Colle l’URL canonique https://www.aliexpress.com/item/{id}.html ou un lien de tracking AliExpress avec ID produit."
    )
    if (!ae.configured) {
      hints.push(
        "Reconnecte l’API AliExpress : GET /api/aliexpress/oauth/start puis ajoute ALIEXPRESS_REFRESH_TOKEN sur Vercel."
      )
    }
    return hints
  }

  hints.push("Vérifie l’URL produit (page fiche, pas l’accueil du site).")
  if (!getScrapingBeeApiKey()) {
    hints.push("SCRAPINGBEE_API_KEY absente — configure-la sur Vercel pour les imports scrape.")
  }
  return hints
}

export function dropForgeImportFailureMessage(marketplaceLabel: string): string {
  return dropForgeIncompleteError(marketplaceLabel, dropForgeImportFailureHints(marketplaceLabel))
}
