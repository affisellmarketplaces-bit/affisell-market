import { NextResponse } from "next/server"

import { groqChatText } from "@/lib/ai/groq-client"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { prisma } from "@/lib/prisma"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function looksNonEnglish(text: string) {
  return /[À-ÿ]|femme|homme|livraison|france|métropolitaine|metropolitaine|blazer lyocell|choisi|tendance/i.test(
    text
  )
}

async function translateCommercialText(input: string, kind: "title" | "description") {
  if (!input.trim() || !process.env.GROQ_API_KEY?.trim()) return input
  const prompt =
    kind === "title"
      ? `Translate to English commercial product title, max 60 chars, remove country names: "${input}"`
      : `Translate this product description to concise commercial English, keep facts and benefits, remove country/location mentions:\n\n${input}`
  try {
    const out = await groqChatText({
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    })
    return out || input
  } catch {
    return input
  }
}

/**
 * ADMIN ONLY. This REWRITES the name and description of up to 200 products, whoever owns them, with a language model
 * (two LLM calls per product). It used to answer anyone: an anonymous POST was a mass overwrite of the catalogue.
 * There is still no dry-run, so an administrator calling it is rewriting production data; limited to 2 runs an hour.
 */
export async function POST(req: Request) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock

  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, gate.session.user.id), {
    limit: 2,
    windowMs: 60 * 60_000,
    prefix: "products-translate",
  })
  if (limited) return limited

  const products = await prisma.product.findMany({
    select: { id: true, name: true, description: true },
    take: 200,
  })

  let updated = 0
  for (const product of products) {
    if (!looksNonEnglish(`${product.name} ${product.description}`)) continue
    const translatedTitle = await translateCommercialText(product.name, "title")
    const translatedDescription = await translateCommercialText(
      product.description,
      "description"
    )
    await prisma.product.update({
      where: { id: product.id },
      data: {
        name: translatedTitle.slice(0, 120),
        description: translatedDescription,
      },
    })
    updated++
  }

  return NextResponse.json({ success: true, scanned: products.length, updated })
}
