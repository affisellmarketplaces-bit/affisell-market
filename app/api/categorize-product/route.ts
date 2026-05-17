export const dynamic = "force-dynamic"
export const revalidate = 0

import { NextResponse } from "next/server"

import { groqChatText } from "@/lib/ai/groq-client"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"

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

const FALLBACK = ["Electronics", "Computers", "Office Products"] as const

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req, null), {
    prefix: "categorize-product",
    limit: 40,
    windowMs: 60_000,
  })
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === "string" ? body.title : ""
  const imageUrl =
    typeof body.imageUrl === "string" ? body.imageUrl : body.imageUrl == null ? null : String(body.imageUrl)

  if (!title.trim() && !imageUrl) {
    return NextResponse.json({ categories: [] })
  }

  const system = `You are a marketplace taxonomy assistant. Given a product title and optional image, return EXACTLY 3 categories from this list: ${BROAD_DEPARTMENT_CHOICES.join(", ")}. Return only JSON: {"categories": ["cat1", "cat2", "cat3"]}`

  const userContent = imageUrl
    ? [
        { type: "text" as const, text: title.trim() ? title : "Product (see image)." },
        { type: "image_url" as const, image_url: { url: imageUrl } },
      ]
    : title.trim()
      ? title
      : "Product (see image)."

  try {
    const raw =
      (await groqChatText({
        vision: Boolean(imageUrl),
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      })) ?? '{"categories":[]}'

    let result: { categories?: string[] }
    try {
      result = JSON.parse(raw) as { categories?: string[] }
    } catch {
      result = { categories: [] }
    }

    const list = Array.isArray(result.categories) ? result.categories : []
    const valid = list.filter((c): c is string => typeof c === "string" && BROAD_DEPARTMENT_CHOICES.includes(c))
    const out = valid.slice(0, 3)
    for (const c of FALLBACK) {
      if (out.length >= 3) break
      if (!out.includes(c)) out.push(c)
    }

    return NextResponse.json({ categories: out.slice(0, 3) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ categories: [...FALLBACK] })
  }
}
