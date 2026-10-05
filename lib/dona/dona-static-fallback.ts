import { DONA_LOGIN_PATH, DONA_SIGNUP_PATH } from "@/lib/dona/dona-links"
import { donaMessageText } from "@/lib/dona/message-utils"
import type { UIMessage } from "ai"

function detectLocale(text: string): "fr" | "en" {
  const t = text.toLowerCase()
  if (/\b(bonjour|salut|comment|affili|revendeur|vendeur|achete|confiance|devenir|inscri|marge|commission)\b/.test(t)) {
    return "fr"
  }
  if (/\b(hello|hi|hey|how|what|seller|affiliate|reseller|join|trust|buy|margin|markup)\b/.test(t)) {
    return "en"
  }
  return "fr"
}

/**
 * Zero-DB offline replies when all LLM providers fail.
 * Keeps Dona responsive with accurate revendeur-first facts.
 */
export function donaPublicOfflineReply(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const text = lastUser ? donaMessageText(lastUser).trim() : ""
  const locale = detectLocale(text)
  const t = text.toLowerCase()

  if (!text || /^(hi|hello|salut|bonjour|hey|coucou|yo)\b/.test(t)) {
    return locale === "fr"
      ? "Capitaine! Dona en ligne — marketplace revendeur-first UE : choisis tes produits, fixe ta marge, vends sur ta vitrine. 💜"
      : "Captain! Dona online — EU reseller-first marketplace: pick products, set your margin, sell on your storefront. 💜"
  }

  if (/marge|markup|margin|prix de vente|selling price|ma propre/.test(t)) {
    return locale === "fr"
      ? "Oui Capitaine — tu fixes **ta marge** sur chaque fiche revendeur (prix vitrine = wholesale + ta marge nette + commission fournisseur). Cockpit revenus dans /dashboard/affiliate. 💜"
      : "Yes Captain — you set **your margin** on each reseller listing (store price = wholesale + your net markup + supplier commission). Earnings cockpit at /dashboard/affiliate. 💜"
  }

  if (/juste une commission|only commission|commission only/.test(t)) {
    return locale === "fr"
      ? "Non — revendeur Affisell = commission fournisseur **+ ta marge nette** que tu configures. Pas de l'affiliation passive Amazon. 💜"
      : "No — Affisell reseller = supplier commission **+ your net markup** you configure. Not passive Amazon-style affiliation. 💜"
  }

  // Supplier before the generic sign-up branch: a supplier is not a reseller, and needs account CREATION, not login.
  if (/fournisseur|supplier|grossiste|wholesaler/.test(t) && /inscri|devenir|cr[ée]er|compte|sign|regist|become|join|account/.test(t)) {
    return locale === "fr"
      ? `Fournisseur : ${DONA_SIGNUP_PATH.supplier} → crée ton compte → liste ton catalogue dans /dashboard/supplier/products. Déjà un compte ? ${DONA_LOGIN_PATH.supplier}. 💜`
      : `Supplier: ${DONA_SIGNUP_PATH.supplier} → create your account → list your catalog in /dashboard/supplier/products. Already registered? ${DONA_LOGIN_PATH.supplier}. 💜`
  }

  if (/affili|revendeur|devenir|rejoin|seller|vendeur|supplier|inscri|commission|gagner/.test(t)) {
    return locale === "fr"
      ? `Revendeur : ${DONA_SIGNUP_PATH.reseller} → choisis produits sur /discover → fixe tes marges → vitrine /dashboard/affiliate. Fournisseur ≠ revendeur (inscription fournisseur : ${DONA_SIGNUP_PATH.supplier}). 💜`
      : `Reseller: ${DONA_SIGNUP_PATH.reseller} → pick products on /discover → set margins → storefront /dashboard/affiliate. Supplier ≠ reseller (supplier sign-up: ${DONA_SIGNUP_PATH.supplier}). 💜`
  }

  if (/drop|arnaque|scam|trust|confiance|s[eé]cur|stripe|rgpd|3d/.test(t)) {
    return locale === "fr"
      ? "Affisell = boutiques vérifiées, achat protégé, Stripe + 3D Secure, RGPD, 33+ pays UE. Pas de marketplace fourre-tout. 💜"
      : "Affisell = verified shops, protected checkout, Stripe + 3D Secure, GDPR, 33+ EU markets. Not a junk marketplace. 💜"
  }

  if (/pulse|radar|march[eé]|live|signal/.test(t)) {
    return locale === "fr"
      ? "Affisell Pulse LIVE — signaux marché sur /radar. Choisis quoi promouvoir avant de fixer tes marges. 💜"
      : "Affisell Pulse LIVE — market signals on /radar. Pick what to promote before setting margins. 💜"
  }

  if (/plus\s+vendu|best.?seller|meilleur(?:e)?s?\s+vente|top\s+vente|bestsellers?|most\s+sold/.test(t)) {
    return locale === "fr"
      ? "Classement live 7 jours sur /marketplace/bestsellers — ventes réelles réseau Affisell. Le #1 change en continu. 💜"
      : "Live 7-day ranking at /marketplace/bestsellers — real network sales on Affisell. #1 updates continuously. 💜"
  }

  if (/achet|buy|client|buyer|marketplace/.test(t)) {
    return locale === "fr"
      ? "Côté acheteur: catalogue premium UE, boutiques vérifiées, checkout sécurisé. /marketplace ou /discover. 💜"
      : "Buyers: premium EU catalog, verified shops, secure checkout. /marketplace or /discover. 💜"
  }

  return locale === "fr"
    ? "Capitaine, réacteurs IA en maintenance — mode offline. Revendeur → /signup/affiliate · Pulse → /radar · Catalogue → /discover. 💜"
    : "Captain, AI reactors in maintenance — offline mode. Reseller → /signup/affiliate · Pulse → /radar · Catalog → /discover. 💜"
}

export function donaCaptainOfflineReply(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const text = lastUser ? donaMessageText(lastUser).trim().toLowerCase() : ""

  if (/env|staging|prod|database|db|branche|branch/.test(text)) {
    return "Capitaine, DB tools offline — vérifie GROQ_API_KEY + DATABASE_URL sur le serveur. Badge env en haut du panneau. 💜"
  }

  if (/boutique|shop|store|vérifi|verified/.test(text)) {
    return "Capitaine, consultation DB indisponible. Quand le réacteur revient: demande « boutiques vérifiées » — tool searchBoutiques read-only. 💜"
  }

  return "Capitaine, Capitaine privé en mode secours. IA + DB read-only indisponibles — réessaie dans 30 s ou vérifie GROQ_API_KEY. 💜"
}
