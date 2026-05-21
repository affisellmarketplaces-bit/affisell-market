import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"

import { auth } from "@/auth"
import { sanitizeReviewText } from "@/lib/reviews/sanitize"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as { body?: string; title?: string; tags?: string[] }
  const rawBody = typeof body.body === "string" ? body.body : ""
  if (rawBody.trim().length < 10) {
    return NextResponse.json({ error: "Body too short" }, { status: 400 })
  }

  const model = process.env.GROQ_API_KEY ? groq("llama-3.3-70b-versatile") : null
  if (!model) {
    return NextResponse.json({ body: sanitizeReviewText(rawBody, 2000), title: body.title ?? null })
  }

  try {
    const { text } = await generateText({
      model,
      prompt: `Rewrite this product review to be clear, authentic, and concise (max 400 words). Keep the same sentiment and facts. Tags: ${(body.tags ?? []).join(", ")}.\n\nReview:\n${rawBody}`,
    })
    const improved = sanitizeReviewText(text, 2000)
    return NextResponse.json({
      body: improved,
      title: body.title ? sanitizeReviewText(String(body.title), 120) : null,
    })
  } catch {
    return NextResponse.json({ body: sanitizeReviewText(rawBody, 2000) })
  }
}
