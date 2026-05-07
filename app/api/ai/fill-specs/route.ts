import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    const { productTitle, attributes, imageUrl } = await req.json()
    
    const schema = attributes.map((a: any) => `${a.key}: ${a.label} ${a.options?`(${a.options.join('/')})`:''}`).join(', ')
    
    const content: any = [
      { type: 'text', text: `Extract product specs from title: "${productTitle}". Return JSON only. Use these exact keys: ${attributes.map((a: any) => a.key).join(', ')}. If unsure, omit the key.` }
    ]
    
    if (imageUrl) {
      content.push({ type: 'image_url', image_url: { url: imageUrl } })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      temperature: 0
    })

    const specs = JSON.parse(completion.choices[0].message.content || '{}')
    return NextResponse.json({ specs })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ specs: {} }, { status: 500 })
  }
}
