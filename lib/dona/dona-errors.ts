import type { AppLocale } from "@/lib/i18n-locale"
import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"

type BinaryLocale = "fr" | "en"

function binaryLocale(locale: AppLocale): BinaryLocale {
  return resolveBinaryCopyLocale(locale)
}

/** Map provider / billing failures to Dona-voice user messages. */
export function formatDonaStreamError(error: unknown, locale: AppLocale = "en"): string {
  const lang = binaryLocale(locale)
  const raw =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error ?? "")

  const msg = raw.toLowerCase()

  if (/no credits|insufficient_quota|billing|payment|exceeded.*quota|credit balance/i.test(msg)) {
    return lang === "fr"
      ? "Capitaine, le réacteur OpenAI est à sec. Groq prend le relais — réessaie dans 5 s. 💜"
      : "Captain, OpenAI reactor is dry. Groq backup engaged — retry in 5 s. 💜"
  }

  if (/rate.?limit|429|too many requests|tpm|tpd/i.test(msg)) {
    return lang === "fr"
      ? "Trop de requêtes — le vaisseau respire 30 s puis réessaie. 💜"
      : "Too many requests — give the ship 30 s then retry. 💜"
  }

  if (/model_not_found|does not exist|not have access/i.test(msg)) {
    return lang === "fr"
      ? "Modèle IA indisponible — bascule auto en cours. Réessaie dans 3 s. 💜"
      : "AI model unavailable — auto-failover in progress. Retry in 3 s. 💜"
  }

  if (/api key|authentication|invalid.*key|401|403/i.test(msg)) {
    return lang === "fr"
      ? "Clé API IA manquante ou invalide côté serveur. Signale au fondateur. 💜"
      : "AI API key missing or invalid on server. Ping the founder. 💜"
  }

  if (/timeout|timed out|deadline|504/i.test(msg)) {
    return lang === "fr"
      ? "Réponse trop lente — reformule ou réessaie (réseau / modèle surchargé). 💜"
      : "Response too slow — rephrase or retry (network / model overload). 💜"
  }

  return lang === "fr"
    ? "Dona: le réacteur tousse. Réessaie — ou explore /sell en attendant. 💜"
    : "Dona: reactor hiccup. Retry — or browse /sell meanwhile. 💜"
}

export function formatDonaUnavailable(locale: AppLocale = "en"): string {
  const lang = binaryLocale(locale)
  return lang === "fr"
    ? "Dona hors ligne — configure GROQ_API_KEY ou OPENAI_API_KEY sur le serveur. 💜"
    : "Dona offline — set GROQ_API_KEY or OPENAI_API_KEY on the server. 💜"
}

/** Prefer API/stream error text over generic widget copy. */
export function resolveDonaChatError(
  error: Error | undefined,
  locale: AppLocale,
  fallback: string
): string {
  if (!error) return fallback
  const msg = error.message?.trim()
  if (!msg) return fallback
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return fallback
  if (msg.length >= 8) return msg
  return fallback
}
