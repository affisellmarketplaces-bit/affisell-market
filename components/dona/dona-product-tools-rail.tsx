"use client"

import {
  donaProductToolHasCards,
  mergeDonaProductToolResults,
  parseDonaProductToolOutput,
} from "@/lib/dona/dona-search-tool-lines"

import { DonaProductRail } from "@/components/dona/dona-product-rail"

export type DonaProductToolPart = {
  type: "tool-searchProducts" | "tool-getBestsellers"
  toolCallId: string
  state: string
  output?: unknown
  errorText?: string
}

function isProductToolPart(part: { type: string }): part is DonaProductToolPart {
  return part.type === "tool-searchProducts" || part.type === "tool-getBestsellers"
}

export function DonaProductToolsRail({ parts }: { parts: DonaProductToolPart[] }) {
  const ready = parts.filter((p) => p.state === "output-available")
  if (ready.length === 0) {
    const pending = parts.some((p) => p.state !== "output-error" && !p.errorText)
    if (pending) {
      return (
        <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
          <span className="size-2 animate-pulse rounded-full bg-violet-400" />
          Signal catalogue…
        </div>
      )
    }
    const err = parts.find((p) => p.state === "output-error" || p.errorText)?.errorText
    if (err) {
      return <p className="mt-2 text-xs text-amber-200">{err}</p>
    }
    return null
  }

  const merged = mergeDonaProductToolResults(ready.map((p) => parseDonaProductToolOutput(p.output)))
  if (!donaProductToolHasCards(merged)) return null

  const mode = ready.some((p) => p.type === "tool-getBestsellers") ? "bestsellers" : "search"
  return <DonaProductRail data={merged} mode={mode} />
}

export { isProductToolPart }
