import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { groqChatText, GROQ_VISION_MODEL } from "@/lib/ai/groq-client"
import type { AppLocale } from "@/lib/i18n-locale"
import { resolveAppLocale } from "@/lib/i18n-locale"
import {
  localeLabel,
  parsePhotoStudioTranslatePayload,
  type PhotoStudioTranslateResponse,
} from "@/lib/photo-studio-translate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_IMAGE_CHARS = 1_400_000

function parseDataUrl(input: string): { mime: string; base64: string } | null {
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null
  return { mime: match[1], base64: match[2] }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER" && role !== "ADMIN" && role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { imageData?: unknown; targetLocale?: unknown }
  try {
    body = (await req.json()) as { imageData?: unknown; targetLocale?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const imageData = typeof body.imageData === "string" ? body.imageData.trim() : ""
  if (!imageData || imageData.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "Invalid or oversized image" }, { status: 400 })
  }

  const parsed = parseDataUrl(imageData)
  if (!parsed) {
    return NextResponse.json({ error: "Expected base64 data URL image" }, { status: 400 })
  }

  const targetLocale: AppLocale = resolveAppLocale(
    typeof body.targetLocale === "string" ? body.targetLocale : null
  )
  const targetName = localeLabel(targetLocale)

  const system = `You are a product photo localization expert for e-commerce.
Detect visible marketing text, labels, badges, and short phrases on the product image.
Return JSON only:
{
  "sourceLocale": "en" | "fr" | "other",
  "segments": [
    {
      "original": "text as shown",
      "translated": "natural ${targetName} for shoppers",
      "xPercent": 0-100,
      "yPercent": 0-100,
      "widthPercent": 0-100,
      "heightPercent": 0-100,
      "textColor": "#RRGGBB optional"
    }
  ]
}
Rules:
- xPercent/yPercent = top-left corner of the text box; width/height = box size as % of image.
- Include only real on-image text (not packaging outside frame). Max 12 segments.
- translated must be in ${targetName}. Keep similar length when possible.
- If no readable text, return {"sourceLocale":"other","segments":[]}.`

  const raw =
    (await groqChatText({
      model: GROQ_VISION_MODEL,
      vision: true,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Translate all visible text on this product photo to ${targetName} for marketplace buyers.`,
            },
            {
              type: "image_url",
              image_url: { url: imageData },
            },
          ],
        },
      ],
    })) ?? "{}"

  let parsedJson: Record<string, unknown>
  try {
    parsedJson = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid model response" }, { status: 502 })
  }

  const result = parsePhotoStudioTranslatePayload(
    JSON.stringify({ ...parsedJson, targetLocale }),
    targetLocale
  )

  if (!result) {
    return NextResponse.json({ error: "Could not analyze text on image" }, { status: 422 })
  }

  return NextResponse.json(result satisfies PhotoStudioTranslateResponse)
}
