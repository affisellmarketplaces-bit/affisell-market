import { groq } from "@ai-sdk/groq"
import { PrismaClient } from "@prisma/client"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai"
import { z } from "zod"

import { auth } from "@/auth"
import { searchCatalogForAgent } from "@/lib/agent-catalog-search"
import {
  buildAgentSearchToolLines,
  directSearchUIMessageStreamResponse,
  isGroqQuotaOrRateLimitError,
  shouldUseDirectCatalogSearch,
} from "@/lib/agent-direct-search"
import { getAgentHistoryForTools, recordAgentSearch, type AgentHistoryContext } from "@/lib/agent-history"
import { compactAgentMessagesForModel } from "@/lib/agent-message-compact"
import { validateAgentMessages } from "@/lib/agent-message-bounds"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { createCheckoutSession } from "@/lib/agent-checkout"
import { formatStoreCurrency } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

/** Shared client instance (same engine as `@/lib/prisma`). */
const db: PrismaClient = prisma

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"
export const revalidate = 0

const SYSTEM_PROMPT = `You are Affisell's Personal Shopping Agent.

Tools:
- **searchProducts** — Call with { "query": "<text>" }. Returns a **JSON array of strings**: each string is one JSON object (parse it). Objects use g=0 for main hits (up to 3) and g=1 for similar products; or { "t":"cat", "c":"..." } for category hints when nothing matched. Do not describe product images; briefly confirm the search only.
- **getUserHistory** — No arguments. Returns a **string array** of recent search queries only.

Stay conversational and helpful.`

const BUY_INTENT_RE = /\b(ach[eè]te|acheter|je prends|commande|prendre)\b/i

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
}

function extractFirstProductIdFromMessages(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== "assistant") continue
    for (const part of m.parts) {
      if (part.type !== "tool-searchProducts") continue
      const output = (part as { output?: unknown }).output
      if (!Array.isArray(output)) continue
      for (const line of output) {
        if (typeof line !== "string") continue
        try {
          const row = JSON.parse(line) as { id?: unknown; g?: unknown; t?: unknown; compact?: unknown }
          if (row.compact) continue
          if (row.t === "cat") continue
          if (typeof row.id === "string" && row.id.trim()) return row.id.trim()
        } catch {
          // ignore invalid tool rows
        }
      }
    }
  }
  return null
}

async function respondWithDirectCatalogSearch(
  messages: UIMessage[],
  query: string,
  historyCtx: AgentHistoryContext
): Promise<Response> {
  const result = await searchCatalogForAgent(db, query)
  await recordAgentSearch(db, historyCtx, query, result.products[0]?.id ?? null)
  const lines = buildAgentSearchToolLines(result)
  console.log("[agent]", { query, direct: true, hits: result.products.length })
  return directSearchUIMessageStreamResponse(messages, query, lines)
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = body as {
    messages?: unknown
    sessionId?: unknown
  }

  const messagesUnknown = parsed.messages
  if (!Array.isArray(messagesUnknown)) {
    return Response.json({ error: "Expected { messages: UIMessage[] }" }, { status: 400 })
  }

  const sessionIdFromBody =
    typeof parsed.sessionId === "string" && parsed.sessionId.trim().length >= 8
      ? parsed.sessionId.trim()
      : null

  const authSession = await auth()
  const userId = authSession?.user?.id ?? null

  const limited = rateLimitResponse(rateLimitClientKey(req, userId), {
    prefix: "agent-chat",
    limit: userId ? 48 : 18,
    windowMs: 60_000,
  })
  if (limited) return limited

  const messages = messagesUnknown as UIMessage[]
  const bounds = validateAgentMessages(messages)
  if (!bounds.ok) {
    return Response.json({ error: bounds.error }, { status: 400 })
  }

  const historyCtx: AgentHistoryContext = {
    userId,
    sessionId: userId ? null : sessionIdFromBody,
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const lastUserText = lastUser ? messageText(lastUser) : ""
  const hasBuyIntent = BUY_INTENT_RE.test(lastUserText)

  if (hasBuyIntent) {
    const candidateProductId = extractFirstProductIdFromMessages(messages)
    if (!candidateProductId) {
      return Response.json({
        error: "Je n'ai pas trouvé de produit récent. Lancez une recherche puis dites \"je prends\".",
      })
    }
    const checkout = await createCheckoutSession(candidateProductId, userId ?? undefined)
    if (!checkout?.checkoutUrl) {
      return Response.json({ error: "Impossible de préparer le paiement pour ce produit." })
    }
    const price = formatStoreCurrency(checkout.priceCents / 100)
    const text = `Parfait! Je prépare votre commande pour ${checkout.name}. [Bouton: Payer ${price}]`
    return Response.json({
      messages: [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          parts: [{ type: "text", text: `${text}\n<checkoutUrl>${checkout.checkoutUrl}</checkoutUrl>` }],
        },
      ],
      checkoutUrl: checkout.checkoutUrl,
    })
  }

  if (lastUserText.trim() && shouldUseDirectCatalogSearch(lastUserText)) {
    return respondWithDirectCatalogSearch(messages, lastUserText.trim(), historyCtx)
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    if (lastUserText.trim()) {
      return respondWithDirectCatalogSearch(messages, lastUserText.trim(), historyCtx)
    }
    return Response.json(
      {
        error:
          "GROQ_API_KEY is not configured. Add it to .env.local for local dev and to Vercel project env vars in production.",
      },
      { status: 503 }
    )
  }

  const compacted = compactAgentMessagesForModel(messages)
  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>
  try {
    modelMessages = await convertToModelMessages(compacted)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid messages payload"
    return Response.json({ error: message }, { status: 400 })
  }

  const searchProducts = tool({
    description: "Search the Affisell product catalog. Input: query text. Output: array of JSON strings (see system prompt).",
    inputSchema: z.object({
      query: z.string(),
    }),
    execute: async ({ query }: { query: string }): Promise<string[]> => {
      const q = query.trim()
      const result = await searchCatalogForAgent(db, q)
      await recordAgentSearch(db, historyCtx, q, result.products[0]?.id ?? null)
      return buildAgentSearchToolLines(result)
    },
  })

  const getUserHistory = tool({
    description: "Recent search queries for this shopper. Output: array of plain strings.",
    inputSchema: z.object({
      hint: z.string().optional(),
    }),
    execute: async (): Promise<string[]> => {
      const h = await getAgentHistoryForTools(db, historyCtx)
      return h.recentQueries
    },
  })

  try {
    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools: { searchProducts, getUserHistory },
      stopWhen: stepCountIs(8),
      onError: ({ error }) => {
        console.error("[agent]", error)
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (e) {
    console.error("[agent] streamText", e)
    if (lastUserText.trim() && isGroqQuotaOrRateLimitError(e)) {
      return respondWithDirectCatalogSearch(messages, lastUserText.trim(), historyCtx)
    }
    const message = e instanceof Error ? e.message : "Agent failed"
    return Response.json({ error: message }, { status: 500 })
  }
}
