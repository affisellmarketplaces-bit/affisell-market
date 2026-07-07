"use client"

import { AffiliateAgentProductCards } from "@/components/affiliate/affiliate-agent-product-cards"
import type {
  AffiliateAgentProductCard,
  AffiliateAgentSearchToolResult,
} from "@/lib/agent-affiliate-product-card-types"

export type AffiliateSearchSupplierToolPart = {
  type: "tool-searchSupplierCatalog"
  toolCallId: string
  state: string
  output?: unknown
  errorText?: string
}

function cardFromParsed(o: Record<string, unknown>): AffiliateAgentProductCard | null {
  if (typeof o.id !== "string" || typeof o.name !== "string") return null
  const basePriceCents =
    typeof o.basePriceCents === "number" ? o.basePriceCents : 0
  const commissionRate =
    typeof o.commissionRate === "number" ? Math.round(o.commissionRate) : 0
  const marginCents =
    typeof o.marginCents === "number"
      ? o.marginCents
      : Math.max(0, Math.round((basePriceCents * commissionRate) / 100))
  const clientPriceCents =
    typeof o.clientPriceCents === "number" && o.clientPriceCents > 0
      ? o.clientPriceCents
      : Math.round(basePriceCents * 1.3)
  return {
    id: o.id,
    name: o.name,
    imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : null,
    description: typeof o.description === "string" ? o.description : "",
    supplierLabel: typeof o.supplierLabel === "string" ? o.supplierLabel : "Fournisseur",
    basePriceCents,
    commissionRate,
    marginCents,
    clientPriceCents,
    usesListedPrice: Boolean(o.usesListedPrice),
    isInStore: Boolean(o.isInStore),
    listingId: typeof o.listingId === "string" ? o.listingId : null,
  }
}

function parseOutput(raw: unknown): AffiliateAgentSearchToolResult | null {
  if (!Array.isArray(raw)) return null

  const products: AffiliateAgentProductCard[] = []
  const similarProducts: AffiliateAgentProductCard[] = []
  const suggestedCategories: string[] = []

  for (const line of raw) {
    if (typeof line !== "string") continue
    try {
      const o = JSON.parse(line) as Record<string, unknown>
      if (o.t === "cat" && typeof o.c === "string") {
        suggestedCategories.push(o.c)
        continue
      }
      const card = cardFromParsed(o)
      if (!card) continue
      if (o.g === 1) similarProducts.push(card)
      else products.push(card)
    } catch {
      /* skip */
    }
  }

  return {
    products: products.slice(0, 3),
    similarProducts: similarProducts.slice(0, 3),
    suggestedCategories,
  }
}

export function AffiliateAgentToolSearchPart({ part }: { part: AffiliateSearchSupplierToolPart }) {
  if (part.state === "output-available") {
    const data = parseOutput(part.output)
    if (!data) return null
    if (data.products.length === 0) {
      return (
        <div className="mt-2 rounded-lg border border-violet-500/20 bg-violet-950/30 px-3 py-2 text-xs text-violet-100/80">
          Aucun SKU fournisseur pour cette recherche.
          {data.suggestedCategories.length > 0 ? (
            <span className="mt-1 block text-zinc-400">
              Catégories à explorer : {data.suggestedCategories.slice(0, 6).join(" · ")}
            </span>
          ) : null}
        </div>
      )
    }
    return (
      <div className="space-y-1">
        <AffiliateAgentProductCards products={data.products} />
        {data.similarProducts.length > 0 ? (
          <AffiliateAgentProductCards
            products={data.similarProducts}
            sectionTitle="Alternatives à comparer"
            sectionSubtitle="Même univers — vérifiez marge et commission"
          />
        ) : null}
      </div>
    )
  }

  if (part.state === "output-error" || part.errorText) {
    return (
      <p className="mt-2 text-xs text-red-300">
        {part.errorText ?? "Recherche catalogue indisponible."}
      </p>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-950/40 px-3 py-2 text-xs text-violet-100/70">
      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
      Analyse du catalogue partenaire…
    </div>
  )
}
