import { type UIMessage } from "ai"

import { validateAgentMessages } from "@/lib/agent-message-bounds"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { logBusiness } from "@/lib/business-log"
import { formatDonaUnavailable } from "@/lib/dona/dona-errors"
import { donaPublicAudiencePromptBlock, type DonaPublicAudience } from "@/lib/dona/dona-audience"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { resolveDonaModels } from "@/lib/dona/dona-model"
import { donaMessageText } from "@/lib/dona/message-utils"
import { DONA_PUBLIC_SYSTEM_PROMPT } from "@/lib/dona/prompt-public"
import { runDonaStreamResponse } from "@/lib/dona/run-dona-stream"
import { isDonaBestsellerIntent } from "@/lib/dona/dona-buyer-intent"
import { BUYER_BESTSELLERS_PATH } from "@/lib/buyer-bestsellers-route"
import { publicBuyerTools } from "@/lib/dona/tools-public"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "dona-public",
    limit: 15,
    windowMs: 60_000,
  })
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = body as { messages?: unknown; audience?: unknown; locale?: unknown }
  const locale = resolveAppLocale(typeof parsed.locale === "string" ? parsed.locale : null)

  if (!resolveDonaModels()) {
    return Response.json(
      {
        error: "dona_unavailable",
        message: formatDonaUnavailable(locale),
      },
      { status: 503 }
    )
  }
  if (!Array.isArray(parsed.messages)) {
    return Response.json({ error: "Expected { messages: UIMessage[] }" }, { status: 400 })
  }

  const audienceRaw = typeof parsed.audience === "string" ? parsed.audience.trim() : "buyer"
  const audience: DonaPublicAudience =
    audienceRaw === "reseller" || audienceRaw === "supplier" ? audienceRaw : "buyer"

  const messages = parsed.messages as UIMessage[]
  const bounds = validateAgentMessages(messages)
  if (!bounds.ok) {
    return Response.json({ error: bounds.error }, { status: 400 })
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const queryPreview = lastUser ? donaMessageText(lastUser).slice(0, 100) : ""

  const lastUserText = lastUser ? donaMessageText(lastUser) : ""
  const bestsellerIntent = audience === "buyer" && isDonaBestsellerIntent(lastUserText)

  logBusiness("dona-public", {
    result: "request",
    queryPreview,
    audience,
    bestsellerIntent,
  })

  const buyerProductBlock =
    audience === "buyer"
      ? `

## Produits acheteur (OBLIGATOIRE)
- **Best-sellers / plus vendu / top ventes / classement** → appelle **getBestsellers** (ventes réelles 7j). Cite le #1 avec son \`url\` + lien hub ${BUYER_BESTSELLERS_PATH}. **Ne pas** utiliser searchProducts pour ça.
- **Recherche par mot-clé** (montre, chaussures, cadeau…) → **searchProducts** une seule fois, puis cite les \`url\` retournés (/marketplace/{listingId}).
- **Interdit** : inventer SKU/IDs, appeler searchProducts deux fois, ou renvoyer vers /discover quand getBestsellers a des résultats.
- Si searchProducts sans hit : une phrase + /discover ou /marketplace — pas de fiche inventée.`
      : ""

  const bestsellerIntentBlock = bestsellerIntent
    ? `

## Intent détecté: CLASSEMENT VENTES
L'utilisateur demande le produit le plus vendu / best-sellers. Appelle **getBestsellers** maintenant. Réponse courte : annonce le #1 + ${BUYER_BESTSELLERS_PATH} pour le top complet.`
    : ""

  return runDonaStreamResponse({
    logPrefix: "dona-public",
    locale,
    system: `${DONA_PUBLIC_SYSTEM_PROMPT}${donaPublicAudiencePromptBlock(audience)}${buyerProductBlock}${bestsellerIntentBlock}`,
    messages,
    temperature: audience === "buyer" ? 0.65 : 0.8,
    tools: audience === "buyer" ? publicBuyerTools : undefined,
    maxSteps: audience === "buyer" ? 4 : undefined,
  })
}
