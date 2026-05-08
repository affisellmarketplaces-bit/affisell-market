export const dynamic = "force-dynamic"

import OpenAI from "openai"

import { AFFISELL_CATEGORIES } from "@/lib/affisell-categories"

const ALL_CATEGORIES = [...AFFISELL_CATEGORIES]

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ categories: [], error: "Missing OPENAI_API_KEY" }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { title, imageUrl } = (await req.json().catch(() => ({}))) as {
    title?: string
    imageUrl?: string
  }

  let prompt = `Given this product title: "${title ?? ""}"`
  if (imageUrl) prompt += ` and this product image`
  prompt += `\nSelect 1-3 most relevant categories from this list: ${ALL_CATEGORIES.join(", ")}.
Return only JSON in this shape: {"categories":["Electronics","Computers"]} using exact category names from the list.`

  const messages: any = [{ role: "user", content: prompt }]
  if (imageUrl) {
    messages[0].content = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageUrl } },
    ]
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    response_format: { type: "json_object" },
  })

  const content = completion.choices?.[0]?.message?.content ?? "{}"
  const result = JSON.parse(content) as { categories?: unknown }
  const categories = Array.isArray(result.categories)
    ? result.categories.filter((x): x is string => typeof x === "string" && ALL_CATEGORIES.includes(x))
    : []
  return Response.json({ categories })
}
