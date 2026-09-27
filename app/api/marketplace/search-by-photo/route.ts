import { NextResponse } from "next/server"

import { groqChatText, GROQ_VISION_MODEL } from "@/lib/ai/groq-client"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { isAllowedSearchByPhotoDataUrl, sanitizeSearchByPhotoQuery } from "@/lib/search-by-photo-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return t
}

const SYSTEM_PROMPT =
  "You turn a buyer's product photo into a short marketplace search query. " +
  "Output JSON only: {\"query\": string}. The query is 3-8 words: product type first, then the most " +
  "identifying visible traits (color, material, pattern, style, visible brand). No sentences, no punctuation " +
  "besides spaces, no guessing at a brand you cannot actually read on the item."

/** Public, unauthenticated — same class of endpoint as /api/dona/chat-public. */
export async function POST(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), {
    limit: 10,
    windowMs: 60_000,
    prefix: "search-by-photo",
  })
  if (limited) return limited

  if (!process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json({ error: "search_by_photo_unavailable" }, { status: 503 })
  }

  let body: { imageDataUrl?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl.trim() : ""
  if (!imageDataUrl || !isAllowedSearchByPhotoDataUrl(imageDataUrl)) {
    return NextResponse.json({ error: "image_required" }, { status: 400 })
  }

  try {
    const raw = await groqChatText({
      model: GROQ_VISION_MODEL,
      vision: true,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "What should I search for to find this product?" },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    })
    if (!raw) throw new Error("empty_response")

    const parsed = JSON.parse(stripJsonFence(raw)) as { query?: unknown }
    const query = sanitizeSearchByPhotoQuery(parsed.query)
    if (!query) {
      return NextResponse.json({ error: "no_match" }, { status: 502 })
    }
    return NextResponse.json({ query })
  } catch (e) {
    console.error("[search-by-photo]", e)
    return NextResponse.json({ error: "analyze_failed" }, { status: 502 })
  }
}
