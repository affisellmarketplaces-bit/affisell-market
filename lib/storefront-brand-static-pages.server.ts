import { groqChatText, GROQ_TEXT_MODEL } from "@/lib/ai/groq-client"
import {
  BRAND_LAUNCH_NICHES,
  isBrandLaunchNiche,
  type BrandLaunchNiche,
} from "@/lib/storefront-brand-launch"
import type { StorefrontStaticPages } from "@/lib/storefront-static-pages-shared"

export type GeneratedBrandStaticPages = StorefrontStaticPages

function clamp(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, max)
}

export function parseGeneratedBrandStaticPages(raw: string): GeneratedBrandStaticPages | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const aboutBody = clamp((o.about as Record<string, unknown> | undefined)?.body, 2000)
    const returnsBody = clamp((o.returns as Record<string, unknown> | undefined)?.body, 2000)
    const faqRaw = (o.faq as Record<string, unknown> | undefined)?.faqItems
    const faqItems: Array<{ question: string; answer: string }> = []
    if (Array.isArray(faqRaw)) {
      for (const row of faqRaw) {
        if (!row || typeof row !== "object") continue
        const item = row as Record<string, unknown>
        const question = clamp(item.question, 600)
        const answer = clamp(item.answer, 600)
        if (!question || !answer) continue
        faqItems.push({ question, answer })
        if (faqItems.length >= 6) break
      }
    }
    if (!aboutBody || faqItems.length < 2 || !returnsBody) return null

    const aboutTitle = clamp((o.about as Record<string, unknown> | undefined)?.title, 120)
    const faqTitle = clamp((o.faq as Record<string, unknown> | undefined)?.title, 120)
    const returnsTitle = clamp((o.returns as Record<string, unknown> | undefined)?.title, 120)

    return {
      about: {
        enabled: true,
        title: aboutTitle || "About us",
        body: aboutBody,
      },
      faq: {
        enabled: true,
        title: faqTitle || "FAQ",
        faqItems,
      },
      returns: {
        enabled: true,
        title: returnsTitle || "Returns & refunds",
        body: returnsBody,
      },
    }
  } catch {
    return null
  }
}

export async function generateStoreBrandStaticPages(args: {
  storeName: string
  description?: string
  niche?: string
  locale?: string
  role: "AFFILIATE" | "SUPPLIER"
}): Promise<GeneratedBrandStaticPages | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null

  const storeName = args.storeName.trim().slice(0, 80) || "My Store"
  const niche: BrandLaunchNiche =
    args.niche && isBrandLaunchNiche(args.niche) ? args.niche : "fashion"
  const locale = args.locale === "fr" ? "fr" : "en"
  const tagline = args.description?.trim().slice(0, 280) ?? ""

  const raw = await groqChatText({
    model: GROQ_TEXT_MODEL,
    temperature: 0.4,
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write EU-compliant ecommerce static pages for creator shops. Return JSON only with keys about, faq, returns. " +
          "Each page has title + body (about/returns) or title + faqItems array (faq). No markdown. No false shipping claims.",
      },
      {
        role: "user",
        content: JSON.stringify({
          storeName,
          tagline,
          niche,
          locale,
          role: args.role,
          allowedNiches: BRAND_LAUNCH_NICHES,
          rules: {
            about: "2-3 sentences brand story",
            faq: "3-4 Q&A about shipping, returns, who fulfills",
            returns: "EU 14-day return summary, contact support with order number",
          },
        }),
      },
    ],
  })

  if (!raw) return null
  return parseGeneratedBrandStaticPages(raw)
}
