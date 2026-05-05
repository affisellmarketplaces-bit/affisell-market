import { groq } from "@ai-sdk/groq"
import { generateObject } from "ai"
import { z } from "zod"

import { auth } from "@/auth"
import { newVariantRowId, type ProductVariantLine } from "@/lib/product-variants"

export const runtime = "nodejs"
export const maxDuration = 30

const BodySchema = z.object({
  productName: z.string().max(240).optional(),
  categories: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  basePriceEur: z.number().nonnegative().optional(),
  commission: z.number().min(0).max(99).optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  const { productName, categories, colors, tags, basePriceEur, commission } = parsed.data
  const baseCents = Math.round((basePriceEur ?? 0) * 100)
  const comm = commission ?? 20

  if (!process.env.GROQ_API_KEY?.trim()) {
    return Response.json({ error: "GROQ_API_KEY is not configured", rows: [] }, { status: 503 })
  }

  const ctxName = (productName ?? "").trim() || "Product"
  const ctx =
    `Product: ${ctxName}\n` +
    `Categories: ${(categories ?? []).join(", ") || "(none)"}\n` +
    `Colors: ${(colors ?? []).join(", ") || "(none)"}\n` +
    `Tags: ${(tags ?? []).join(", ") || "(none)"}`

  try {
    const { object } = await generateObject({
      model: groq("llama-3.3-70b-versatile"),
      schema: z.object({
        variants: z
          .array(
            z.object({
              name: z.string().max(160),
              sku: z.string().max(80),
            })
          )
          .max(16),
      }),
      prompt: `${ctx}\n\nSuggest up to 12 distinct commercial SKU variants (combinations of options where sensible). Each needs a short buyer-facing name and a compact SKU code (uppercase, alphanumeric and dashes). Respond only via schema.`,
    })

    const rows: ProductVariantLine[] = object.variants.map((v) => ({
      id: newVariantRowId(),
      name: v.name.trim().slice(0, 160),
      sku: v.sku.trim().slice(0, 80),
      priceCents: Math.max(0, baseCents),
      stock: 0,
      commission: Math.round(comm),
      sales: 0,
    }))

    return Response.json({ rows })
  } catch {
    return Response.json({ error: "AI suggestion failed", rows: [] }, { status: 503 })
  }
}
