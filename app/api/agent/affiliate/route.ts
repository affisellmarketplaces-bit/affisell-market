import { groq } from "@ai-sdk/groq"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai"
import { z } from "zod"

import { auth } from "@/auth"
import { validateAgentMessages } from "@/lib/agent-message-bounds"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { searchSupplierCatalogForAffiliateAgent } from "@/lib/agent-affiliate-catalog-search"
import type { AffiliateAgentProductCard } from "@/lib/agent-affiliate-product-card-types"
import { recordAgentSearch, type AgentHistoryContext } from "@/lib/agent-history"
import { loadAffiliateCatalogHighlights } from "@/lib/affiliate-catalog-query"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

function encodeAffiliateRow(p: AffiliateAgentProductCard, group: 0 | 1): string {
  return JSON.stringify({
    g: group,
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    description: p.description,
    supplierLabel: p.supplierLabel,
    basePriceCents: p.basePriceCents,
    commissionRate: p.commissionRate,
    marginCents: p.marginCents,
    clientPriceCents: p.clientPriceCents,
    usesListedPrice: p.usesListedPrice,
    isInStore: p.isInStore,
    listingId: p.listingId,
  })
}

const SYSTEM_PROMPT = `You are Affisell's Reseller Sourcing Agent — you help Affisell resellers (affiliate sellers, no inventory) pick profitable supplier SKUs for their storefront.

You do NOT help end shoppers buy products. Never suggest checkout or "je prends".

Tools:
- **searchSupplierCatalog** — { "query": "<text>" }. Returns JSON strings: parse each. g=0 main picks (up to 3), g=1 similar SKUs, or { "t":"cat", "c":"..." } when empty.
- **getCatalogHighlights** — no input. Returns best sellers (7d), new arrivals, and high-margin SKUs as JSON strings (h=0|1|2).
- **getUserHistory** — recent sourcing searches (strings only).

When presenting results:
- Prioritize estimated reseller earnings (marginCents = commission + markup at clientPriceCents; usesListedPrice=true means their live listing price).
- Compare commission %, client price, supplier, and whether already in their vitrine (isInStore).
- Recommend 1–2 clear picks with short rationale (niche fit, earnings, trend).
- Suggest next step: add to vitrine via the card CTA or refine search.

Stay concise, professional, in French unless the user writes in English.`

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Connexion affilié requise." }, { status: 401 })
  }
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return Response.json({ error: "Réservé aux comptes affilié." }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = body as { messages?: unknown }
  if (!Array.isArray(parsed.messages)) {
    return Response.json({ error: "Expected { messages: UIMessage[] }" }, { status: 400 })
  }

  const limited = rateLimitResponse(rateLimitClientKey(req, session.user.id), {
    prefix: "agent-affiliate-chat",
    limit: 40,
    windowMs: 60_000,
  })
  if (limited) return limited

  const messages = parsed.messages as UIMessage[]
  const bounds = validateAgentMessages(messages)
  if (!bounds.ok) {
    return Response.json({ error: bounds.error }, { status: 400 })
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    return Response.json(
      { error: "GROQ_API_KEY is not configured." },
      { status: 503 }
    )
  }

  const affiliateId = session.user.id
  const historyCtx: AgentHistoryContext = { userId: affiliateId, sessionId: null }

  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>
  try {
    modelMessages = await convertToModelMessages(messages)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid messages payload"
    return Response.json({ error: message }, { status: 400 })
  }

  const searchSupplierCatalog = tool({
    description:
      "Search supplier catalog for affiliate sourcing. Input: query. Output: JSON string array.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }: { query: string }): Promise<string[]> => {
      const q = query.trim()
      const result = await searchSupplierCatalogForAffiliateAgent(prisma, affiliateId, q)
      await recordAgentSearch(prisma, historyCtx, `[sourcing] ${q}`, result.products[0]?.id ?? null)

      const lines: string[] = []
      for (const p of result.products) lines.push(encodeAffiliateRow(p, 0))
      for (const p of result.similarProducts) lines.push(encodeAffiliateRow(p, 1))
      if (lines.length === 0 && result.suggestedCategories.length > 0) {
        for (const c of result.suggestedCategories) {
          lines.push(JSON.stringify({ t: "cat", c }))
        }
      }
      return lines
    },
  })

  const getCatalogHighlights = tool({
    description:
      "Best sellers (7d), new arrivals, and high-margin SKUs from the reseller catalog. No input.",
    inputSchema: z.object({}),
    execute: async (): Promise<string[]> => {
      const highlights = await loadAffiliateCatalogHighlights(affiliateId, new URLSearchParams(), 5)
      const lines: string[] = []
      const encodeHighlight = (
        h: 0 | 1 | 2,
        card: {
          productId: string
          name: string
          imageUrl: string | null
          supplierLabel: string
          basePriceCents: number
          commissionRate: number
          marginCents: number
          soldCount: number
          isInStore: boolean
          listingId: string | null
        }
      ) =>
        JSON.stringify({
          h,
          id: card.productId,
          name: card.name,
          imageUrl: card.imageUrl,
          supplierLabel: card.supplierLabel,
          basePriceCents: card.basePriceCents,
          commissionRate: card.commissionRate,
          marginCents: card.marginCents,
          sold7d: card.soldCount,
          isInStore: card.isInStore,
          listingId: card.listingId,
        })

      for (const card of highlights.bestSellers7d) lines.push(encodeHighlight(0, card))
      for (const card of highlights.newArrivals) lines.push(encodeHighlight(1, card))
      for (const card of highlights.highMargin) lines.push(encodeHighlight(2, card))
      return lines
    },
  })

  const getUserHistory = tool({
    description: "Recent affiliate sourcing search queries.",
    inputSchema: z.object({ hint: z.string().optional() }),
    execute: async (): Promise<string[]> => {
      const rows = await prisma.searchHistory.findMany({
        where: { userId: affiliateId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { query: true },
      })
      return rows
        .map((r) => r.query.replace(/^\[sourcing\]\s*/i, "").trim())
        .filter(Boolean)
    },
  })

  try {
    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools: { searchSupplierCatalog, getCatalogHighlights, getUserHistory },
      stopWhen: stepCountIs(12),
      onError: ({ error }) => {
        console.error("[agent/affiliate]", error)
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (e) {
    console.error("[agent/affiliate] streamText", e)
    const message = e instanceof Error ? e.message : "Agent failed"
    return Response.json({ error: message }, { status: 500 })
  }
}
