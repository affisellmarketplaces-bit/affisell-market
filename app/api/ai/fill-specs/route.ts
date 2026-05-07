import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  const { productTitle, attributes, imageUrl } = await req.json()
  
  if (!attributes?.length) {
    return NextResponse.json({ specs: {} })
  }

  const attrList = attributes.map(a => `${a.key}: ${a.label}`).join('\n')
  
  const prompt = `Extract product specifications from this title: "${productTitle}"
  
Return ONLY a JSON object matching these keys:
${attrList}

Rules:
- Use exact keys from the list
- If info not in title, leave empty string ""
- For iPhone: Brand=Apple, OS=iOS
- For storage in title like "256GB": Storage Capacity=256GB
- For color in title like "Natural Titanium": Color=Natural Titanium

JSON only, no explanation.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'user', 
          content: imageUrl 
           ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }]
            : prompt 
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0
    })

    const specs = JSON.parse(completion.choices[0].message.content || '{}')
    return NextResponse.json({ specs })
  } catch (e) {
    return NextResponse.json({ error: 'AI failed', specs: {} }, { status: 500 })
  }
}
