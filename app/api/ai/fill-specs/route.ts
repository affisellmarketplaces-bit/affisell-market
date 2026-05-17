import { NextResponse } from "next/server"

import { groqChatText } from "@/lib/ai/groq-client"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(req: Request) {
  try {
    const { productTitle, imageUrl }: { productTitle?: string; imageUrl?: string } = await req.json()
    if (!productTitle && !imageUrl) {
      return NextResponse.json({ error: "Either productTitle or imageUrl is required" }, { status: 400 })
    }

    const categories = await prisma.category.findMany({
      include: { attributes: true },
    })

    const userContent = [
      {
        type: "text" as const,
        text: `Categories: ${categories
          .map(
            (c) =>
              `${c.id}:${c.name} ATTRS:${c.attributes.map((a) => `${a.key}:${a.label}`).join(",")}`
          )
          .join(" | ")}`,
      },
      ...(productTitle ? [{ type: "text" as const, text: `Product title: ${productTitle}` }] : []),
      ...(imageUrl ? [{ type: "image_url" as const, image_url: { url: imageUrl } }] : []),
    ]

    const raw = await groqChatText({
      vision: Boolean(imageUrl),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a product data extractor. Given a product title and/or image, and a list of categories with attributes, return JSON: {categoryId: string, specs: {key: value}}. Only use categoryId and attribute keys from the provided list. Extract from image if available.",
        },
        { role: "user", content: userContent },
      ],
    })

    if (!raw) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
    }

    const parsed = JSON.parse(raw) as { categoryId?: string; specs?: Record<string, string> }
    const categoryId = typeof parsed?.categoryId === "string" ? parsed.categoryId : ""
    const categoryName =
      categories.find((c) => c.id === categoryId)?.name ??
      (typeof (parsed as { categoryName?: string }).categoryName === "string"
        ? (parsed as { categoryName: string }).categoryName
        : "")
    const specs =
      parsed?.specs && typeof parsed.specs === "object" ? (parsed.specs as Record<string, string>) : {}

    return NextResponse.json({ categoryId, categoryName, specs })
  } catch {
    return NextResponse.json({ error: "AI failed" }, { status: 500 })
  }
}
