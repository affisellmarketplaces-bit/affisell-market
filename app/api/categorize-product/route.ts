export const dynamic = "force-dynamic"
import OpenAI from "openai"

const ALL_CATEGORIES: string[] = [
  "Clothing, Shoes & Jewelry", "Collectibles & Fine Art", "Computers", "Daily Deals",
  "Digital Music", "Electronics", "Garden & Outdoor", "Gift Cards", "Grocery & Gourmet Food",
  "Handmade", "Health & Household", "Home & Kitchen", "Industrial & Scientific",
  "Luggage & Travel Gear", "Luxury Stores", "Magazine Subscriptions", "Movies & TV",
  "Musical Instruments", "Office Products", "Pet Supplies", "Prime Video", "Smart Home",
  "Software", "Sports & Outdoors", "Tools & Home Improvement", "Toys & Games",
  "Vehicles", "Video Games"
]

export async function POST(req: Request) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const { title, imageUrl } = await req.json()
    
    if (!title && !imageUrl) {
      return Response.json({ categories: [] })
    }

    let prompt = `You are a TikTok Shop categorization expert. Given product title: "${title || "No title"}"`
    if (imageUrl) prompt += ` and this product image.`
    prompt += `\nSelect 1-3 most relevant categories from this exact list: ${ALL_CATEGORIES.join(", ")}. 
    Return ONLY a JSON object like: {"categories": ["Electronics", "Computers"]}`

    const messages: any[] = [{ role: "user", content: [{ type: "text", text: prompt }] }]
    if (imageUrl) {
      messages[0].content.push({ type: "image_url", image_url: { url: imageUrl } })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
      temperature: 0
    })
    
    const result = JSON.parse(completion.choices[0].message.content || '{"categories":[]}')
    const aiCategories = result.categories || []
    const validCategories = aiCategories.filter((cat: string) => ALL_CATEGORIES.includes(cat))
    
    return Response.json({ categories: validCategories.slice(0, 3) })
  } catch (e) {
    return Response.json({ categories: [] }, { status: 200 })
  }
}
