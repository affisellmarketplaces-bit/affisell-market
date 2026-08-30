/**
 * Route-aware Dona persona — buyer home ≠ revendeur landing.
 */

import type { AppLocale } from "@/lib/i18n-locale"
import { SUPPORTED_LOCALES } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

export type DonaPublicAudience = "buyer" | "reseller" | "supplier"

const RESELLER_PREFIXES = [
  "/sell",
  "/creators",
  "/partners",
  "/how-it-works",
  "/agent",
] as const

const SUPPLIER_PREFIXES = ["/supplier", "/sell/become-supplier"] as const

/** Buyer-first routes: home, catalogue, checkout, vitrines publiques. */
const BUYER_PREFIXES = [
  "/marketplace/bestsellers",
  "/bestsellers",
  "/marketplace",
  "/discover",
  "/shops",
  "/store",
  "/cart",
  "/checkout",
  "/wishlist",
  "/track-order",
  "/success",
  "/market",
  "/boutique",
  "/u/",
  "/legion",
] as const

const LOCALE_ROOT_PATTERN = new RegExp(`^/(${SUPPORTED_LOCALES.join("|")})(/|$)`)

export function resolveDonaPublicAudience(pathname: string): DonaPublicAudience {
  const path = pathname.split("?")[0]?.trim() || "/"

  if (SUPPLIER_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return "supplier"
  }
  if (RESELLER_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return "reseller"
  }
  if (BUYER_PREFIXES.some((p) => path === p || path.startsWith(p))) {
    return "buyer"
  }

  // Home + locale roots = acheteur (hero « boutiques de confiance »)
  if (path === "/" || LOCALE_ROOT_PATTERN.test(path)) {
    return "buyer"
  }

  // Default public: assume shopper unless on explicit seller/supplier landings
  return "buyer"
}

export function donaPublicWelcome(audience: DonaPublicAudience, locale: AppLocale): string {
  return tMessage(locale, `donaWidget.audience.${audience}.welcome`)
}

export function donaPublicPlaceholder(audience: DonaPublicAudience, locale: AppLocale): string {
  return tMessage(locale, `donaWidget.audience.${audience}.placeholder`)
}

export function donaPublicBadge(audience: DonaPublicAudience, locale: AppLocale): string {
  return tMessage(locale, `donaWidget.audience.${audience}.badge`)
}

/** Prioritize audience in LLM system prompt without dropping full product knowledge. */
export function donaPublicAudiencePromptBlock(audience: DonaPublicAudience): string {
  if (audience === "reseller") {
    return `
## Contexte page actuelle: REVENDEUR
L'utilisateur est sur une landing revendeur/creator. Priorise: marge perso, /signup/affiliate, catalogue /discover, Pulse /radar.
Ne force pas le pitch acheteur sauf s'il pose une question d'achat.`
  }
  if (audience === "supplier") {
    return `
## Contexte page actuelle: FOURNISSEUR
Priorise: lister catalogue, toucher revendeurs UE, /login/supplier, payout B2B.
Ne confonds pas avec revendeur.`
  }
  return `
## Contexte page actuelle: ACHETEUR (shopper)
L'utilisateur parcourt le marketplace ou la home acheteur. Priorise: confiance, achat protégé, retours 14j UE, trouver une boutique/produit, checkout sécurisé.
Pour tout produit ou lien : getBestsellers (top ventes) ou searchProducts (mot-clé) — cite url (/marketplace/{listingId}) ou hub /bestsellers — jamais de SKU inventé.
Ne parle de marge revendeur ou /signup/affiliate QUE s'il demande « vendre », « revendeur », « devenir affilié » ou similaire.
Évite « Capitaine » en ouverture — « Bonjour » suffit. Tu peux dire Capitaine seulement s'il se présente comme revendeur.`
}
