import { groqChatText, GROQ_TEXT_MODEL } from "@/lib/ai/groq-client"
import {
  BRAND_LAUNCH_NICHES,
  isBrandLaunchNiche,
  type BrandLaunchNiche,
} from "@/lib/storefront-brand-launch"

export type GeneratedBrandCopy = {
  description: string
  storyBody: string
  ctaTitle: string
  ctaBody: string
}

const MAX_DESCRIPTION = 280
const MAX_STORY = 400
const MAX_CTA_TITLE = 80
const MAX_CTA_BODY = 160

function clamp(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, max)
}

export function parseGeneratedBrandCopy(raw: string): GeneratedBrandCopy | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const description = clamp(o.description, MAX_DESCRIPTION)
    const storyBody = clamp(o.storyBody, MAX_STORY)
    const ctaTitle = clamp(o.ctaTitle, MAX_CTA_TITLE)
    const ctaBody = clamp(o.ctaBody, MAX_CTA_BODY)
    if (!description || !storyBody) return null
    return {
      description,
      storyBody,
      ctaTitle: ctaTitle || "Shop the collection",
      ctaBody: ctaBody || "Curated picks your audience will love.",
    }
  } catch {
    return null
  }
}

export async function generateStoreBrandCopy(args: {
  storeName: string
  niche?: string
  locale?: string
}): Promise<GeneratedBrandCopy | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null

  const storeName = args.storeName.trim().slice(0, 80) || "My Store"
  const niche: BrandLaunchNiche = isBrandLaunchNiche(args.niche ?? "")
    ? args.niche
    : "fashion"
  const locale = args.locale === "fr" ? "fr" : "en"

  const raw = await groqChatText({
    model: GROQ_TEXT_MODEL,
    temperature: 0.45,
    max_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write concise ecommerce storefront copy for creator affiliate shops. Return JSON only with keys: description, storyBody, ctaTitle, ctaBody. No markdown. EU-friendly tone, no false claims.",
      },
      {
        role: "user",
        content: JSON.stringify({
          storeName,
          niche,
          locale,
          allowedNiches: BRAND_LAUNCH_NICHES,
          rules: {
            description: "1-2 sentences, max 220 chars, for store header",
            storyBody: "2-3 sentences brand story, max 350 chars",
            ctaTitle: "short CTA headline",
            ctaBody: "one line supporting CTA",
          },
        }),
      },
    ],
  })

  if (!raw) return null
  return parseGeneratedBrandCopy(raw)
}
