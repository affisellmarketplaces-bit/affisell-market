/**
 * Route-aware Dona persona — buyer home ≠ revendeur landing.
 */

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
  if (path === "/" || /^\/(fr|en)(\/|$)/.test(path)) {
    return "buyer"
  }

  // Default public: assume shopper unless on explicit seller/supplier landings
  return "buyer"
}

export function donaPublicWelcome(audience: DonaPublicAudience, locale: "fr" | "en"): string {
  if (audience === "reseller") {
    return locale === "fr"
      ? "Capitaine, mode revendeur. Choisis tes produits, fixe ta marge, vends sur ta vitrine — je t'explique tout. 💜"
      : "Captain, reseller mode. Pick products, set your margin, sell on your storefront — ask me anything. 💜"
  }
  if (audience === "supplier") {
    return locale === "fr"
      ? "Capitaine, mode fournisseur. Liste une fois, touche des revendeurs dans 33 pays UE — pose tes questions. 💜"
      : "Captain, supplier mode. List once, reach resellers in 33 EU countries — fire away. 💜"
  }
  return locale === "fr"
    ? "Bonjour — Dona ici. Boutiques vérifiées, achat protégé, livraison UE. Je t'aide à trouver ou acheter en confiance. 💜"
    : "Hi — Dona here. Verified shops, protected checkout, EU delivery. I help you shop with confidence. 💜"
}

export function donaPublicPlaceholder(audience: DonaPublicAudience, locale: "fr" | "en"): string {
  if (audience === "reseller") {
    return locale === "fr" ? "Marge, inscription revendeur…" : "Margin, reseller signup…"
  }
  if (audience === "supplier") {
    return locale === "fr" ? "Catalogue, payout fournisseur…" : "Catalog, supplier payout…"
  }
  return locale === "fr"
    ? "Produit, boutique, livraison, retours…"
    : "Product, shop, shipping, returns…"
}

export function donaPublicBadge(audience: DonaPublicAudience): string {
  if (audience === "reseller") return "Revendeur"
  if (audience === "supplier") return "Fournisseur"
  return "Achat"
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
Pour tout produit ou lien : searchProducts puis cite le champ url (/marketplace/{listingId}) — jamais de SKU inventé.
Ne parle de marge revendeur ou /signup/affiliate QUE s'il demande « vendre », « revendeur », « devenir affilié » ou similaire.
Évite « Capitaine » en ouverture — « Bonjour » suffit. Tu peux dire Capitaine seulement s'il se présente comme revendeur.`
}
