import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai"

import type { AgentSearchToolResult } from "@/lib/agent-product-card-types"
import type { AgentProductCard } from "@/lib/agent-product-card-types"

const BUY_INTENT_RE = /\b(ach[eè]te|acheter|je prends|commande|prendre)\b/i

const CONVERSATIONAL_PREFIX_RE =
  /^(comment|pourquoi|compare|difference|différence|explique|aide|help|bonjour|salut|merci|hello|hi)\b/i

/** Short product lookups skip Groq (saves tokens, works when quota is hit). */
export function shouldUseDirectCatalogSearch(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 120) return false
  if (BUY_INTENT_RE.test(t)) return false
  if (/\?/.test(t)) return false
  if (CONVERSATIONAL_PREFIX_RE.test(t)) return false
  return true
}

export function encodeAgentSearchRow(p: AgentProductCard, group: 0 | 1): string {
  return JSON.stringify({
    g: group,
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    brand: p.brand,
    description: p.description,
  })
}

export function buildAgentSearchToolLines(result: AgentSearchToolResult): string[] {
  const lines: string[] = []
  for (const p of result.products) {
    lines.push(encodeAgentSearchRow(p, 0))
  }
  for (const p of result.similarProducts) {
    lines.push(encodeAgentSearchRow(p, 1))
  }
  if (lines.length === 0 && result.suggestedCategories.length > 0) {
    for (const c of result.suggestedCategories) {
      lines.push(JSON.stringify({ t: "cat", c }))
    }
  }
  return lines
}

export function isGroqQuotaOrRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /TPD|TP,|rate.?limit|too large|429/i.test(msg)
}

/** SSE response compatible with `useChat` + `DefaultChatTransport`. */
export function directSearchUIMessageStreamResponse(
  messages: UIMessage[],
  query: string,
  lines: string[]
): Response {
  const messageId = crypto.randomUUID()
  const toolCallId = crypto.randomUUID()
  const intro =
    lines.length > 0
      ? `Voici ce que j'ai trouvé pour « ${query} ».`
      : `Aucun résultat pour « ${query} ». Essayez un autre mot-clé ou parcourez le catalogue.`

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: ({ writer }) => {
      writer.write({ type: "start", messageId })
      writer.write({ type: "start-step" })
      writer.write({ type: "text-start", id: messageId })
      writer.write({ type: "text-delta", id: messageId, delta: intro })
      writer.write({ type: "text-end", id: messageId })
      writer.write({
        type: "tool-input-start",
        toolCallId,
        toolName: "searchProducts",
        providerExecuted: true,
      })
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "searchProducts",
        input: { query },
        providerExecuted: true,
      })
      writer.write({
        type: "tool-output-available",
        toolCallId,
        output: lines,
        providerExecuted: true,
      })
      writer.write({ type: "finish-step" })
      writer.write({ type: "finish", finishReason: "stop" })
    },
  })

  return createUIMessageStreamResponse({ stream })
}
