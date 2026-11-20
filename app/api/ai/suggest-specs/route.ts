import { NextRequest, NextResponse } from "next/server"

import { guardSupplierAiRoute } from "@/lib/ai-route-guards"
import { parseSpecsAiInput } from "@/lib/ai-spec-input"
import { groqChatText } from "@/lib/ai/groq-client"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

/** Supplier/admin only (+ the shared per-user AI rate limit): every call is a paid vision-model request. */
export async function POST(req: NextRequest) {
  const guard = await guardSupplierAiRoute(req, "ai-suggest-specs")
  if (!guard.ok) return guard.response

  try {
    const parsedInput = parseSpecsAiInput(await req.json().catch(() => ({})))
    if (!parsedInput.ok) {
      return NextResponse.json({ error: parsedInput.error }, { status: 400 })
    }
    const { productTitle, imageUrl } = parsedInput.input

    const categories = await prisma.category.findMany({
      include: { attributes: true },
    })

    const userContent = [
      {
        type: "text" as const,
        text: `Categories: ${categories
          .map((c) => `${c.id}:${c.name} ATTRS:${c.attributes.map((a) => a.key).join(",")}`)
          .join(" | ")}`,
      },
      ...(productTitle ? [{ type: "text" as const, text: `Title: ${productTitle}` }] : []),
      ...(imageUrl ? [{ type: "image_url" as const, image_url: { url: imageUrl } }] : []),
    ]

    const raw = await groqChatText({
      vision: Boolean(imageUrl),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a product data extractor. Given a product title and/or image, and a list of categories with attributes, return JSON: {categoryId: string, categoryName: string, specs: {key: value}}. Only use categoryId and attribute keys from the provided list. If image provided, extract brand, color, material from it.",
        },
        { role: "user", content: userContent },
      ],
    })

    if (!raw) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
    }

    const parsed = JSON.parse(raw) as { categoryId?: string; specs?: Record<string, string> }
    const categoryId = typeof parsed?.categoryId === "string" ? parsed.categoryId : ""
    const categoryName = categories.find((c) => c.id === categoryId)?.name || ""
    const specs =
      parsed?.specs && typeof parsed.specs === "object" ? (parsed.specs as Record<string, string>) : {}

    return NextResponse.json({ categoryId, categoryName, specs })
  } catch {
    return NextResponse.json({ error: "AI failed" }, { status: 500 })
  }
}
