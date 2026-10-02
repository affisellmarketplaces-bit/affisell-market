import { NextResponse } from "next/server"

import { groqChatText } from "@/lib/ai/groq-client"
import { guardSupplierAiRoute } from "@/lib/ai-route-guards"

export const dynamic = "force-dynamic"
export const revalidate = 0

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
  const gate = await guardSupplierAiRoute(req, "categorize-product")
  if (!gate.ok) return gate.response

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === "string" ? body.title : ""
  const imageUrl =
    typeof body.imageUrl === "string" ? body.imageUrl : body.imageUrl == null ? null : String(body.imageUrl)

  if (!title.trim() && !imageUrl) {
    return NextResponse.json({ categories: [] })
  }

  const system = `You are a marketplace taxonomy assistant. Given a product title and optional image, return up to 3 categories from this list, only those that really fit (fewer is fine): ${BROAD_DEPARTMENT_CHOICES.join(", ")}. Return only JSON: {"categories": ["cat1", "cat2", "cat3"]}`

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
    // Only departments the model actually chose. Padding with fixed ones ("Electronics, Computers…") presented
    // unrelated categories as suggestions for any product whenever the model answered partially or failed.
    const valid = [...new Set(list.filter((c): c is string => typeof c === "string" && BROAD_DEPARTMENT_CHOICES.includes(c)))]

    return NextResponse.json({ categories: valid.slice(0, 3) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ categories: [] })
  }
}
