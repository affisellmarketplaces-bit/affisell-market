import { hasOpenAiFallback, openaiChatText } from "@/lib/ai/openai-chat-fallback"
import { LEGAL_AI_MODEL } from "@/lib/legal/brain"

export type TrademarkCheckResult = {
  hasTrademark: boolean
  brands: string[]
  confidence: number
  risk: "low" | "high"
  mock?: boolean
}

const TRADEMARK_PROMPT = `Analyse cette image produit e-commerce.
Contient-elle un logo ou marque déposée visible (Nike, Adidas, Apple, Louis Vuitton, Gucci, Chanel, Rolex, etc.) ?
Réponds UNIQUEMENT en JSON :
{
  "hasTrademark": true,
  "brands": ["Nike"],
  "confidence": 85,
  "risk": "high"
}
Si aucune marque identifiable : hasTrademark false, brands [], confidence 0, risk "low".`

function parseTrademarkResponse(raw: string): TrademarkCheckResult {
  try {
    const parsed = JSON.parse(raw) as {
      hasTrademark?: boolean
      brands?: string[]
      confidence?: number
      risk?: string
    }
    const brands = Array.isArray(parsed.brands)
      ? parsed.brands.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
      : []
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
        : 0
    const hasTrademark = parsed.hasTrademark === true || brands.length > 0
    const risk: "low" | "high" =
      parsed.risk === "high" || (hasTrademark && confidence >= 60) ? "high" : "low"

    return { hasTrademark, brands, confidence, risk }
  } catch {
    return { hasTrademark: false, brands: [], confidence: 0, risk: "low" }
  }
}

export async function checkImageTrademark(imageUrl: string): Promise<TrademarkCheckResult> {
  if (!imageUrl.trim()) {
    return { hasTrademark: false, brands: [], confidence: 0, risk: "low" }
  }

  if (!hasOpenAiFallback()) {
    console.warn("[legal:vision]", {
      result: "trademark_skipped",
      reason: "OPENAI_API_KEY missing",
    })
    return { hasTrademark: false, brands: [], confidence: 0, risk: "low", mock: true }
  }

  try {
    const raw = await openaiChatText({
      model: LEGAL_AI_MODEL,
      vision: true,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TRADEMARK_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse anti-contrefaçon visuelle." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    })

    if (!raw) {
      return { hasTrademark: false, brands: [], confidence: 0, risk: "low" }
    }

    const result = parseTrademarkResponse(raw)
    console.log("[legal:vision]", {
      result: "trademark_checked",
      hasTrademark: result.hasTrademark,
      brands: result.brands,
      risk: result.risk,
    })
    return result
  } catch (error) {
    console.error("[legal:vision]", {
      result: "trademark_error",
      error: error instanceof Error ? error.message : String(error),
    })
    return { hasTrademark: false, brands: [], confidence: 0, risk: "low" }
  }
}
