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
        `Reconnecte l’API : ${ALIEXPRESS_OAUTH_START_PATH} (la session est enregistrée automatiquement).`
      )
    } else if (tokenKind) {
      hints.push(aliExpressOAuthReconnectHint(tokenKind))
      if (tokenKind !== "unavailable") {
        // The session is stored encrypted in the database and renewed automatically — never copy tokens to env.
        hints.push("Après autorisation, la session est enregistrée automatiquement (chiffrée en base) et renouvelée toute seule.")
      }
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

    if (opts?.suggestBrowserBridge && (!tokenKind || tokenKind === "unavailable")) {
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

  /**
   * 1688, CJ Dropshipping and BigBuy import via their own authenticated API — ScrapingBee is
   * never involved for them, so the generic ScrapingBee hint below would be misleading.
   */
  if (marketplaceLabel === "1688") {
    if (!process.env.ONEBOUND_KEY?.trim() || !process.env.ONEBOUND_SECRET?.trim()) {
      hints.push("ONEBOUND_KEY / ONEBOUND_SECRET absentes — configure-les sur Vercel (api-gw.onebound.cn).")
    } else if (opts?.apiError?.trim()) {
      hints.push(`Erreur API OneBound : ${opts.apiError.trim().slice(0, 200)}`)
    }
    return hints
  }
  if (marketplaceLabel === "CJ Dropshipping") {
    if (!process.env.CJ_API_EMAIL?.trim() || !process.env.CJ_API_KEY?.trim()) {
      hints.push("CJ_API_EMAIL / CJ_API_KEY absentes — configure-les sur Vercel (developers.cjdropshipping.com).")
    } else if (opts?.apiError?.trim()) {
      hints.push(`Erreur API CJ : ${opts.apiError.trim().slice(0, 200)}`)
    }
    return hints
  }
  if (marketplaceLabel === "BigBuy") {
    if (!process.env.BIGBUY_API_KEY?.trim()) {
      hints.push("BIGBUY_API_KEY absente — demande une clé via le formulaire de contact BigBuy (bigbuy.eu/en/api_bigbuy.html).")
    } else if (opts?.apiError?.trim()) {
      hints.push(`Erreur API BigBuy : ${opts.apiError.trim().slice(0, 200)}`)
    }
    return hints
  }

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
