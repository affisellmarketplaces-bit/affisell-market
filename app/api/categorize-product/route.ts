export const dynamic = "force-dynamic"
export const revalidate = 0

import { NextResponse } from "next/server"
import OpenAI from "openai"

const BROAD_DEPARTMENT_CHOICES = [
  "Computers",
  "Electronics",
  "Mobile Phones & Accessories",
  "Cameras & Photo",
  "Home & Kitchen",
  "Office Products",
  "Sports & Outdoors",
  "Toys & Games",
  "Clothing, Shoes & Jewelry",
  "Beauty & Personal Care",
  "Health & Household",
  "Tools & Home Improvement",
  "Automotive",
  "Pet Supplies",
  "Books",
  "Video Games",
]

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === "string" ? body.title : ""
  const imageUrl =
    typeof body.imageUrl === "string" ? body.imageUrl : body.imageUrl == null ? null : String(body.imageUrl)

  if (!title.trim() && !imageUrl) {
    return NextResponse.json({ categories: [] })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      categories: ["Electronics", "Computers", "Office Products"],
    })
  }

  try {
    const openai = new OpenAI({ apiKey })

    const system = `You are a marketplace taxonomy assistant. Given a product title and optional image, return EXACTLY 3 categories from this list: ${BROAD_DEPARTMENT_CHOICES.join(", ")}. Return only JSON: {"categories": ["cat1", "cat2", "cat3"]}`

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: title.trim() ? title : "Product (see image)." },
    ]
    if (imageUrl && typeof imageUrl === "string") {
      userContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    })

    const raw = completion.choices[0]?.message?.content ?? '{"categories":[]}'
    let result: { categories?: string[] }
    try {
      result = JSON.parse(raw) as { categories?: string[] }
    } catch {
      result = { categories: [] }
    }

    const list = Array.isArray(result.categories) ? result.categories : []
    const valid = list.filter((c): c is string => typeof c === "string" && BROAD_DEPARTMENT_CHOICES.includes(c))
    const out = valid.slice(0, 3)
    for (const c of ["Electronics", "Computers", "Office Products"] as const) {
      if (out.length >= 3) break
      if (!out.includes(c)) out.push(c)
    }

    return NextResponse.json({ categories: out.slice(0, 3) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({
      categories: ["Electronics", "Computers", "Office Products"],
    })
  }
}
