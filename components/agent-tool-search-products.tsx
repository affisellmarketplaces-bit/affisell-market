"use client"

import { AgentProductCards } from "@/components/AgentProductCards"
import type { AgentProductCard, AgentSearchToolResult } from "@/lib/agent-product-card-types"

/** Runtime UI stream shape for the `searchProducts` tool (not narrowed on default `UIMessage` generics). */
export type SearchProductsToolPart = {
  type: "tool-searchProducts"
  toolCallId: string
  state: string
  output?: unknown
  errorText?: string
}

function cardFromParsed(o: Record<string, unknown>): AgentProductCard | null {
  if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.price !== "number") return null
  return {
    id: o.id,
    name: o.name,
    price: o.price,
    imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : null,
    brand: typeof o.brand === "string" ? o.brand : "Affisell",
    description: typeof o.description === "string" ? o.description : "",
  }
}

/** Supports Groq-friendly `string[]` tool output and legacy `{ products, ... }` objects. */
function parseOutput(raw: unknown): AgentSearchToolResult | null {
  if (Array.isArray(raw)) {
    const products: AgentProductCard[] = []
    const similarProducts: AgentProductCard[] = []
    const suggestedCategories: string[] = []

    for (const line of raw) {
      if (typeof line !== "string") continue
      try {
        const o = JSON.parse(line) as Record<string, unknown>
        if (o.t === "cat" && typeof o.c === "string") {
          suggestedCategories.push(o.c)
          continue
        }
        const g = o.g === 1 ? 1 : 0
        const card = cardFromParsed(o)
        if (!card) continue
        if (g === 1) similarProducts.push(card)
        else products.push(card)
      } catch {
        /* skip bad line */
      }
    }
    return {
      products: products.slice(0, 3),
      similarProducts: similarProducts.slice(0, 3),
      suggestedCategories,
    }
  }

  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.products)) {
      const similarProducts = Array.isArray(o.similarProducts) ? o.similarProducts : []
      return {
        ...(raw as AgentSearchToolResult),
        products: o.products as AgentProductCard[],
        similarProducts: similarProducts as AgentProductCard[],
        suggestedCategories: Array.isArray(o.suggestedCategories)
          ? (o.suggestedCategories as string[])
          : [],
      }
    }
  }

  return null
}

export function AgentToolSearchProductsPart({ part }: { part: SearchProductsToolPart }) {
  if (part.state === "output-available") {
    const data = parseOutput(part.output)
    if (!data) return null
    if (data.products.length === 0) {
      return (
        <div className="mt-2 rounded-lg border border-zinc-600/60 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
          No products matched this search.
          {data.suggestedCategories.length > 0 ? (
            <span className="mt-1 block text-zinc-500">
              Try browsing: {data.suggestedCategories.slice(0, 6).join(" · ")}
            </span>
          ) : null}
        </div>
      )
    }
    return (
      <div className="space-y-1">
        <AgentProductCards products={data.products} />
        {data.similarProducts?.length ? (
          <AgentProductCards
            products={data.similarProducts}
            sectionTitle="Produits similaires"
            sectionSubtitle="Similaire à votre recherche"
          />
        ) : null}
      </div>
    )
  }

  if (part.state === "output-error" || (typeof part.errorText === "string" && part.errorText)) {
    return (
      <p className="mt-2 text-xs text-red-300">
        {typeof part.errorText === "string" ? part.errorText : "Product search failed."}
      </p>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-600/50 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
      Loading product cards…
    </div>
  )
}
