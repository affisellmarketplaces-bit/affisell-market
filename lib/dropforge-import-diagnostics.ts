import { getAliExpressApiReadyStatus } from "@/lib/aliexpress-api-ready.server"
import { dropForgeIncompleteError } from "@/lib/dropforge-complete-import"
import { getScrapingBeeApiKey } from "@/lib/import-url-scrape"
import {
  ALIEXPRESS_OAUTH_START_PATH,
  aliExpressOAuthReconnectHint,
  classifyAliExpressTokenError,
} from "@/lib/aliexpress-token-errors"

/** Actionable hints for ops / suppliers when DropForge completeness gate fails. */
export async function dropForgeImportFailureHints(
  marketplaceLabel: string,
  opts?: { suggestBrowserBridge?: boolean; apiError?: string | null }
): Promise<string[]> {
  const hints: string[] = []

  if (marketplaceLabel === "AliExpress") {
    const tokenKind = classifyAliExpressTokenError(opts?.apiError ?? "")
    const ae = await getAliExpressApiReadyStatus()
    if (!ae.configured) {
      hints.push(ae.message)
      hints.push(
        `Reconnecte l’API : ${ALIEXPRESS_OAUTH_START_PATH} puis tokens sur Vercel (ALIEXPRESS_REFRESH_TOKEN).`
      )
    } else if (tokenKind) {
      hints.push(aliExpressOAuthReconnectHint(tokenKind))
      hints.push(
        "Après autorisation, copie ALIEXPRESS_REFRESH_TOKEN sur Vercel → redéploie, ou laisse la session chiffrée en base."
      )
    } else if (ae.tokenSource === "db") {
      hints.push(
        ae.accountHint
          ? `Session OAuth en base (${ae.accountHint}).`
          : "Session OAuth chiffrée en base."
      )
      if (opts?.apiError?.trim()) {
        hints.push(`Erreur API : ${opts.apiError.trim().slice(0, 200)}`)
      } else {
        hints.push("API AliExpress DS — aliexpress.ds.product.get (api-sg).")
      }
    } else {
      hints.push("Credentials AliExpress DS configurés (env).")
      if (opts?.apiError?.trim()) {
        hints.push(`Erreur API : ${opts.apiError.trim().slice(0, 200)}`)
      } else {
        hints.push("Import via aliexpress.ds.product.get (api-sg).")
      }
    }

    if (opts?.suggestBrowserBridge && !tokenKind) {
      hints.push(
        "Utilise le pont Express Bridge ci-dessous : votre navigateur lit la page AliExpress (100 % fiable, sans ScrapingBee)."
      )
    } else if (opts?.suggestBrowserBridge && tokenKind) {
      hints.push(
        "Le pont navigateur reste disponible en secours — reconnectez d’abord OAuth pour l’import API instantané."
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
  suggestBrowserBridge?: boolean,
  apiError?: string | null
): Promise<string> {
  return dropForgeIncompleteError(
    marketplaceLabel,
    await dropForgeImportFailureHints(marketplaceLabel, {
      suggestBrowserBridge: suggestBrowserBridge === true,
      apiError,
    })
  )
}

export function extractAliExpressApiErrorFromWarnings(warnings: string[]): string | null {
  for (const w of warnings) {
    const m = w.match(/^API AliExpress\s*:\s*(.+)/i)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}
