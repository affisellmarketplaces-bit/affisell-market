import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function looksNonEnglish(text: string) {
  return /[À-ÿ]|femme|homme|livraison|france|métropolitaine|metropolitaine|blazer lyocell|choisi|tendance/i.test(
    text
  )
}

async function translateCommercialText(input: string, kind: "title" | "description") {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !input.trim()) return input
  const prompt =
    kind === "title"
      ? `Translate to English commercial product title, max 60 chars, remove country names: "${input}"`
      : `Translate this product description to concise commercial English, keep facts and benefits, remove country/location mentions:\n\n${input}`
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return input
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return payload.choices?.[0]?.message?.content?.trim() || input
  } catch {
    return input
  }
}

export async function POST() {
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
