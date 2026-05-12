import OpenAI from "openai"
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
    }
    const { productTitle, imageUrl }: { productTitle?: string; imageUrl?: string } = await req.json()
    if (!productTitle && !imageUrl) {
      return NextResponse.json({ error: 'Either productTitle or imageUrl is required' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const categories = await prisma.category.findMany({ include: { attributes: true } })

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a product data extractor. Given a product title and/or image, and a list of categories with attributes, return JSON: {categoryId: string, categoryName: string, specs: {key: value}}. Only use categoryId and attribute keys from the provided list. If image provided, extract brand, color, material from it.',
      },
    ]

    const userContent: ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: `Categories: ${categories
          .map((c) => `${c.id}:${c.name} ATTRS:${c.attributes.map((a) => a.key).join(',')}`)
          .join(' | ')}`,
      },
    ]

    if (productTitle) userContent.push({ type: 'text', text: `Title: ${productTitle}` })
    if (imageUrl) userContent.push({ type: 'image_url', image_url: { url: imageUrl } })

    messages.push({ role: 'user', content: userContent })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    const categoryId = typeof parsed?.categoryId === 'string' ? parsed.categoryId : ''
    const categoryName = categories.find((c) => c.id === categoryId)?.name || ''
    const specs =
      parsed?.specs && typeof parsed.specs === 'object' ? (parsed.specs as Record<string, string>) : {}

    return NextResponse.json({ categoryId, categoryName, specs })
  } catch {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
