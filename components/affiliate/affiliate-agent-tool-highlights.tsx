"use client"

import { useTranslations } from "next-intl"

import { AffiliateAgentProductCards } from "@/components/affiliate/affiliate-agent-product-cards"
import { parseCatalogHighlightsToolOutput } from "@/lib/agent-affiliate-highlights-parse"

export type AffiliateCatalogHighlightsToolPart = {
  type: "tool-getCatalogHighlights"
  toolCallId: string
  state: string
  output?: unknown
  errorText?: string
}

export function AffiliateAgentToolHighlightsPart({ part }: { part: AffiliateCatalogHighlightsToolPart }) {
  const t = useTranslations("affiliate.sourcingAgent")

  if (part.state === "output-available") {
    const data = parseCatalogHighlightsToolOutput(part.output)
    if (!data) {
      return (
        <div className="mt-2 rounded-lg border border-violet-500/20 bg-violet-950/30 px-3 py-2 text-xs text-violet-100/80">
          {t("highlightsEmpty")}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {data.bestSellers.length > 0 ? (
          <AffiliateAgentProductCards
            products={data.bestSellers}
            sectionTitle={t("highlightsBestSellers")}
            sectionSubtitle={t("highlightsBestSellersHint")}
          />
        ) : null}
        {data.highMargin.length > 0 ? (
          <AffiliateAgentProductCards
            products={data.highMargin}
            sectionTitle={t("highlightsHighMargin")}
            sectionSubtitle={t("highlightsHighMarginHint")}
          />
        ) : null}
        {data.newArrivals.length > 0 ? (
          <AffiliateAgentProductCards
            products={data.newArrivals}
            sectionTitle={t("highlightsNewArrivals")}
            sectionSubtitle={t("highlightsNewArrivalsHint")}
          />
        ) : null}
      </div>
    )
  }

  if (part.state === "output-error" || part.errorText) {
    return (
      <p className="mt-2 text-xs text-red-300">
        {part.errorText ?? t("highlightsError")}
      </p>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-950/40 px-3 py-2 text-xs text-violet-100/70">
      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
      {t("highlightsLoading")}
    </div>
  )
}
