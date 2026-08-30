"use client"

import { parseDonaSearchToolOutput } from "@/lib/dona/dona-search-tool-lines"

import { DonaProductCards } from "@/components/dona/dona-linkify-text"

export type DonaSearchProductsToolPart = {
  type: "tool-searchProducts"
  toolCallId: string
  state: string
  output?: unknown
  errorText?: string
}

export function DonaToolSearchProductsPart({ part }: { part: DonaSearchProductsToolPart }) {
  if (part.state === "output-available") {
    const data = parseDonaSearchToolOutput(part.output)
    if (!data) return null
    if (data.products.length === 0) {
      return (
        <div className="mt-2 rounded-lg border border-white/10 bg-[#12122e] px-3 py-2 text-xs text-white/60">
          Aucun produit trouvé.
          {data.suggestedCategories.length > 0 ? (
            <span className="mt-1 block text-white/40">
              Parcourir : {data.suggestedCategories.slice(0, 5).join(" · ")}
            </span>
          ) : null}
        </div>
      )
    }
    return (
      <div className="space-y-2">
        <DonaProductCards products={data.products} />
        {data.similarProducts.length > 0 ? (
          <DonaProductCards products={data.similarProducts} title="Similaires" />
        ) : null}
      </div>
    )
  }

  if (part.state === "output-error" || (typeof part.errorText === "string" && part.errorText)) {
    return (
      <p className="mt-2 text-xs text-amber-200">
        {typeof part.errorText === "string" ? part.errorText : "Recherche indisponible."}
      </p>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
      <span className="size-2 animate-pulse rounded-full bg-violet-400" />
      Recherche catalogue…
    </div>
  )
}
