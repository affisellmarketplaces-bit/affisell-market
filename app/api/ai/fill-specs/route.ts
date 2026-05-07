import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const { productTitle } = await req.json()
    const categories = await prisma.category.findMany({
      include: { attributes: true },
    })

    const categoryList = categories
      .map((c) => {
        const attrs = c.attributes.map((a) => `${a.key}:${a.label}`).join(',')
        return `${c.id}:${c.name} ATTRS:${attrs}`
      })
      .join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a product data extractor. Given a product title and list of categories with their attributes, return JSON: {categoryId: string, specs: {key: value}}. Only use categoryId and attribute keys that exist in the provided list.',
        },
        {
          role: 'user',
          content: `productTitle: ${productTitle}\ncategories:\n${categoryList}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    })

    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: 'AI failed' }, { status: 500 })
  }
}
