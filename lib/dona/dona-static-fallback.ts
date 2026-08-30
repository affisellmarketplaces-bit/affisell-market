import { donaMessageText } from "@/lib/dona/message-utils"
import type { UIMessage } from "ai"

function detectLocale(text: string): "fr" | "en" {
  const t = text.toLowerCase()
  if (/\b(bonjour|salut|comment|affili|vendeur|achete|confiance|devenir|inscri)\b/.test(t)) {
    return "fr"
  }
  if (/\b(hello|hi|hey|how|what|seller|affiliate|join|trust|buy)\b/.test(t)) {
    return "en"
  }
  return "fr"
}

/**
 * Zero-DB offline replies when all LLM providers fail.
 * Keeps Dona responsive for marketing / affiliation FAQs.
 */
export function donaPublicOfflineReply(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const text = lastUser ? donaMessageText(lastUser).trim() : ""
  const locale = detectLocale(text)
  const t = text.toLowerCase()

  if (!text || /^(hi|hello|salut|bonjour|hey|coucou|yo)\b/.test(t)) {
    return locale === "fr"
      ? "Capitaine! Dona en ligne — affiliation UE, boutiques vérifiées, Pulse LIVE. Pose ta question. 💜"
      : "Captain! Dona online — EU affiliates, verified shops, Pulse LIVE. Ask away. 💜"
  }

  if (/affili|devenir|rejoin|seller|vendeur|supplier|inscri|commission|gagner/.test(t)) {
    return locale === "fr"
      ? "Modèle Affisell: tu apportes le trafic, on gère boutique + paiement Stripe + confiance UE (pas du dropshipping scam). Inscription → /dashboard/supplier · Pulse → /radar 💜"
      : "Affisell model: you bring traffic, we handle shop + Stripe + EU trust (no scam dropshipping). Sign up → /dashboard/supplier · Pulse → /radar 💜"
  }

  if (/drop|arnaque|scam|trust|confiance|s[eé]cur|stripe|rgpd|3d/.test(t)) {
    return locale === "fr"
      ? "Affisell = boutiques vérifiées, achat protégé, Stripe + 3D Secure, RGPD, 27 marchés UE. Pas de marketplace fourre-tout. 💜"
      : "Affisell = verified shops, protected checkout, Stripe + 3D Secure, GDPR, 27 EU markets. Not a junk marketplace. 💜"
  }

  if (/pulse|radar|march[eé]|live|signal/.test(t)) {
    return locale === "fr"
      ? "Affisell Pulse LIVE — signaux marché en direct sur /radar. Idéal pour choisir quoi promouvoir avant de t'inscrire. 💜"
      : "Affisell Pulse LIVE — live market signals on /radar. Pick what to promote before you sign up. 💜"
  }

  if (/achet|buy|client|buyer|marketplace/.test(t)) {
    return locale === "fr"
      ? "Côté acheteur: catalogue premium UE, boutiques à la une, paiement sécurisé. Explore /marketplace ou /discover. 💜"
      : "Buyers: premium EU catalog, featured shops, secure checkout. Browse /marketplace or /discover. 💜"
  }

  return locale === "fr"
    ? "Capitaine, réacteurs IA en maintenance — je reste en mode marketing offline. /dashboard/supplier pour vendre, /radar pour Pulse, /sell pour le pitch. 💜"
    : "Captain, AI reactors in maintenance — marketing offline mode. /dashboard/supplier to sell, /radar for Pulse, /sell for the pitch. 💜"
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
