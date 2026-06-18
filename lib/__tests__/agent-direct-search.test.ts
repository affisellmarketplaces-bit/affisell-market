import { describe, expect, it } from "vitest"

import {
  buildAgentSearchToolLines,
  encodeAgentSearchRow,
  isGroqQuotaOrRateLimitError,
  shouldUseDirectCatalogSearch,
} from "@/lib/agent-direct-search"
import { compactAgentMessagesForModel } from "@/lib/agent-message-compact"
import type { UIMessage } from "ai"

describe("agent-direct-search", () => {
  it("routes short product queries to direct catalog search", () => {
    expect(shouldUseDirectCatalogSearch("télé")).toBe(true)
    expect(shouldUseDirectCatalogSearch("chaussures running")).toBe(true)
    expect(shouldUseDirectCatalogSearch("comment ça marche ?")).toBe(false)
    expect(shouldUseDirectCatalogSearch("je prends le premier")).toBe(false)
  })

  it("detects Groq quota errors", () => {
    expect(
      isGroqQuotaOrRateLimitError(new Error("Request too large for TPD: Limit 100000, Requested 128000"))
    ).toBe(true)
    expect(isGroqQuotaOrRateLimitError(new Error("network timeout"))).toBe(false)
  })

  it("encodes search tool lines", () => {
    const lines = buildAgentSearchToolLines({
      products: [
        {
          id: "p1",
          name: "TV 55",
          price: 499,
          imageUrl: null,
          brand: "Store",
          description: "",
        },
      ],
      similarProducts: [],
      suggestedCategories: [],
    })
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0]!) as { id: string; g: number }
    expect(parsed.id).toBe("p1")
    expect(parsed.g).toBe(0)
    expect(encodeAgentSearchRow({ id: "x", name: "n", price: 1, imageUrl: null, brand: "b", description: "" }, 1)).toContain('"g":1')
  })
})

describe("agent-message-compact", () => {
  it("strips heavy tool output from model history", () => {
    const heavy = JSON.stringify({ g: 0, id: "p1", name: "x".repeat(500), price: 10 })
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "télé" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "tool-searchProducts", toolCallId: "t1", state: "output-available", output: [heavy] }],
      },
      { id: "u2", role: "user", parts: [{ type: "text", text: "commode" }] },
    ]
    const compact = compactAgentMessagesForModel(messages)
    const toolPart = compact[1]?.parts[0] as { output?: string[] }
    expect(toolPart.output?.[0]).toContain("compact")
    expect(toolPart.output?.[0]).not.toContain("x".repeat(100))
  })
})
