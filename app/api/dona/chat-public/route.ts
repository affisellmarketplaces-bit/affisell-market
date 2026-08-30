import { type UIMessage } from "ai"

import { validateAgentMessages } from "@/lib/agent-message-bounds"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { logBusiness } from "@/lib/business-log"
import { formatDonaUnavailable } from "@/lib/dona/dona-errors"
import { donaPublicAudiencePromptBlock, type DonaPublicAudience } from "@/lib/dona/dona-audience"
import { resolveDonaModels } from "@/lib/dona/dona-model"
import { donaMessageText } from "@/lib/dona/message-utils"
import { DONA_PUBLIC_SYSTEM_PROMPT } from "@/lib/dona/prompt-public"
import { runDonaStreamResponse } from "@/lib/dona/run-dona-stream"
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

  if (!resolveDonaModels()) {
    return Response.json(
      {
        error: "dona_unavailable",
        message: formatDonaUnavailable("fr"),
      },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = body as { messages?: unknown; audience?: unknown }
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

  logBusiness("dona-public", { result: "request", queryPreview, audience })

  const buyerProductBlock =
    audience === "buyer"
      ? `

## Produits acheteur (OBLIGATOIRE)
- Si l'utilisateur cherche un produit, demande un lien, ou dit « lien » après une recherche : appelle **searchProducts** avec la requête pertinente (mot-clé ou produit cité dans l'historique).
- Cite **uniquement** les champs \`url\` retournés (format /marketplace/{listingId}). Ce sont les seuls liens valides.
- **Interdit** d'inventer des SKU, IDs, ou chemins (/product/AF-xxx, codes fictifs).
- Si aucun résultat : oriente vers /discover ou /marketplace — n'invente pas de fiche.`
      : ""

  return runDonaStreamResponse({
    logPrefix: "dona-public",
    system: `${DONA_PUBLIC_SYSTEM_PROMPT}${donaPublicAudiencePromptBlock(audience)}${buyerProductBlock}`,
    messages,
    temperature: audience === "buyer" ? 0.65 : 0.8,
    tools: audience === "buyer" ? publicBuyerTools : undefined,
    maxSteps: audience === "buyer" ? 4 : undefined,
  })
}
