import Groq from "groq-sdk"

import { searchCatalogForAgent } from "@/lib/agent-catalog-search"
import { prisma } from "@/lib/prisma"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY?.trim()) {
      return Response.json({ error: "GROQ_API_KEY is not configured." }, { status: 503 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    let image = ""

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("image")
      if (file instanceof File) {
        const mime = file.type || "image/jpeg"
        const bytes = Buffer.from(await file.arrayBuffer())
        image = `data:${mime};base64,${bytes.toString("base64")}`
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as { image?: unknown }
      image = typeof body.image === "string" ? body.image.trim() : ""
    }

    if (!image.startsWith("data:image/")) {
      return Response.json({ error: "Invalid image payload." }, { status: 400 })
    }

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this product in 3-5 keywords for e-commerce search in French. Only return keywords separated by commas.",
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    })
    console.log("[agent/vision] groq", JSON.stringify(completion))

    const keywords = completion.choices?.[0]?.message?.content?.trim() || ""
    const terms = keywords
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    const firstTerm = terms[0] || keywords
    const searchQuery = firstTerm.split(" ")[0] || firstTerm
    console.log("[vision] searching for:", searchQuery)
    const results = await searchCatalogForAgent(prisma, searchQuery)
    return Response.json({
      keywords,
      searchQuery,
      products: results.products,
      similarProducts: results.similarProducts,
      suggestedCategories: results.suggestedCategories,
    })
  } catch (error) {
    console.error("[agent/vision] failed", error)
    return Response.json({ error: "Vision failed" }, { status: 500 })
  }
}
