import { NextResponse } from "next/server"

import { groqChatText, GROQ_TEXT_MODEL } from "@/lib/ai/groq-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type ClassifyCopyResponse = {
  title: string
  bulletPoints: string[]
}

function emptyCopy(): NextResponse<ClassifyCopyResponse> {
  return NextResponse.json({ title: "", bulletPoints: [] })
}

function parseCopyPayload(raw: unknown): ClassifyCopyResponse {
  if (!raw || typeof raw !== "object") {
    return { title: "", bulletPoints: [] }
  }
  const o = raw as Record<string, unknown>
  const title = typeof o.title === "string" ? o.title.trim() : ""
  const bulletsRaw = o.bulletPoints ?? o.bullet_points
  const bulletPoints = Array.isArray(bulletsRaw)
    ? bulletsRaw
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12)
    : []
  return { title, bulletPoints }
}

export async function POST(req: Request): Promise<NextResponse<ClassifyCopyResponse>> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return emptyCopy()
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ title: "", bulletPoints: [] }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ title: "", bulletPoints: [] }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  let prompt = typeof o.prompt === "string" ? o.prompt.trim() : ""
  if (!prompt) {
    const title = typeof o.title === "string" ? o.title.trim() : ""
    const description = typeof o.description === "string" ? o.description.trim() : ""
    if (title || description) {
      prompt = [title && `Titre actuel: ${title}`, description && `Description: ${description}`]
        .filter(Boolean)
        .join("\n")
    }
  }

  if (!prompt) {
    return NextResponse.json({ title: "", bulletPoints: [] }, { status: 400 })
  }

  try {
    const content = await groqChatText({
      model: GROQ_TEXT_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Tu es un copywriter e-commerce. Génère un titre produit optimisé Amazon et 4 à 6 bullet points de vente. Réponds uniquement en JSON: {"title": string, "bulletPoints": string[]}',
        },
        { role: "user", content: prompt },
      ],
    })

    if (!content) {
      return emptyCopy()
    }

    return NextResponse.json(parseCopyPayload(JSON.parse(content)))
  } catch {
    return emptyCopy()
  }
}
