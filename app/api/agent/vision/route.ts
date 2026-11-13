import { GROQ_VISION_MODEL, groqChatText } from "@/lib/ai/groq-client"
import { searchCatalogForAgent } from "@/lib/agent-catalog-search"
import {
  AGENT_VISION_MAX_REQUEST_BYTES,
  agentVisionImageFromBytes,
  agentVisionImageFromDataUrl,
  type AgentVisionImage,
} from "@/lib/agent-vision-input"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { prisma } from "@/lib/prisma"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * PUBLIC on purpose (the assistant page is open to visitors), but every call is a paid vision-model request: same-site
 * browsers only, 10 per minute and 40 per hour per client, 4 MB, and the format is read from the bytes.
 */
export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY?.trim() && !process.env.OPENAI_API_KEY?.trim()) {
      return Response.json({ error: "GROQ_API_KEY is not configured." }, { status: 503 })
    }

    const originBlock = assertSameSiteRequestOrigin(req)
    if (originBlock) return originBlock

    const clientKey = rateLimitClientKey(req)
    const perMinute = await rateLimitResponseAsync(clientKey, { limit: 10, windowMs: 60_000, prefix: "agent-vision" })
    if (perMinute) return perMinute
    const perHour = await rateLimitResponseAsync(clientKey, {
      limit: 40,
      windowMs: 60 * 60_000,
      prefix: "agent-vision-hour",
    })
    if (perHour) return perHour

    const declaredLength = Number(req.headers.get("content-length"))
    if (Number.isFinite(declaredLength) && declaredLength > AGENT_VISION_MAX_REQUEST_BYTES) {
      return Response.json({ error: "Image too large (4 MB maximum)." }, { status: 413 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    let parsedImage: AgentVisionImage = { ok: false, status: 400, error: "Invalid image payload." }

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("image")
      if (file instanceof File) {
        if (file.size > AGENT_VISION_MAX_REQUEST_BYTES) {
          return Response.json({ error: "Image too large (4 MB maximum)." }, { status: 413 })
        }
        parsedImage = agentVisionImageFromBytes(Buffer.from(await file.arrayBuffer()))
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as { image?: unknown }
      if (typeof body.image === "string") parsedImage = agentVisionImageFromDataUrl(body.image)
    }

    if (!parsedImage.ok) {
      return Response.json({ error: parsedImage.error }, { status: parsedImage.status })
    }
    const image = parsedImage.dataUrl

    const keywords = await groqChatText({
      model: GROQ_VISION_MODEL,
      vision: true,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this product in 3-5 keywords for e-commerce search in French. Only return keywords separated by commas.",
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    })
    console.log("[agent/vision]", { result: keywords ? "ok" : "empty", model: GROQ_VISION_MODEL })

    const terms = (keywords ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    const firstTerm = terms[0] || keywords || ""
    const searchQuery = firstTerm.split(" ")[0] || firstTerm
    console.log("[vision] searching for:", searchQuery)
    const results = await searchCatalogForAgent(prisma, searchQuery)
    return Response.json({
      keywords,
      searchQuery,
      products: results.products,
      similarProducts: results.similarProducts,
      suggestedCategories: results.suggestedCategories,
    })
  } catch (error) {
    console.error("[agent/vision] failed", error)
    return Response.json({ error: "Vision failed" }, { status: 500 })
  }
}
