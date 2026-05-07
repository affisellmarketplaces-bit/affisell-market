import { NextResponse } from "next/server"

import OpenAI from "openai"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SuggestBody = {
  title?: string
  categoryId?: string
  imageUrl?: string | null
}

function safeJsonParse(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text)
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as SuggestBody
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : ""
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : null

  if (!title || !categoryId) {
    return NextResponse.json({ error: "Missing title or categoryId" }, { status: 400 })
  }

  const attributes = await prisma.categoryAttribute.findMany({
    where: { categoryId, aiSuggest: true },
    orderBy: [{ order: "asc" }, { label: "asc" }],
  })

  const schema = attributes.map((a) => ({
    key: a.key,
    label: a.label,
    type: a.type,
    unit: a.unit,
    options: a.options,
  }))

  const prompt = `Extract product specifications from this product.

Product: "${title}"
Required specs schema: ${JSON.stringify(schema)}

Rules:
1. Return ONLY valid JSON with keys matching the schema
2. For select/multiselect, use exact values from options if possible
3. For numbers, return numeric value only (as a number), not a string
4. If unknown, use null
5. Be accurate.
Example: {"brand":"Apple","color":"Black","storage_capacity":"256GB"}`

  const client = new OpenAI({ apiKey })

  const userContent = imageUrl
    ? ([
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ] as const)
    : prompt

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a product data expert. Extract specs as JSON only.",
      },
      { role: "user", content: userContent as unknown as string },
    ],
  })

  const content = completion.choices?.[0]?.message?.content ?? "{}"
  const suggestions = safeJsonParse(content)

  return NextResponse.json({ suggestions, attributes })
}

