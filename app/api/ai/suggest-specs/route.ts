import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { title, categoryId, imageUrl } = await req.json()
  
  const attributes = await prisma.categoryAttribute.findMany({
    where: { categoryId, aiSuggest: true },
    orderBy: { order: 'asc' }
  })
  
  const schema = attributes.map(a => ({
    key: a.key,
    label: a.label,
    type: a.type,
    unit: a.unit,
    options: a.options
  }))
  
  const prompt = `Extract product specifications from this product.
Title: "${title}"
Required specs: ${JSON.stringify(schema)}

Rules:
1. Return ONLY valid JSON with keys matching the schema
2. For select/multiselect, use exact values from options
3. For numbers, extract numeric value only
4. If unknown, use null
Example: {"brand":"Apple","color":"Black","storage_capacity":"256GB"}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You extract product specs as JSON only.' },
      { role: 'user', content: imageUrl? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } }
      ] : prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1
  })

  const suggestions = JSON.parse(completion.choices[0].message.content || '{}')
  return NextResponse.json({ suggestions, attributes })
}
