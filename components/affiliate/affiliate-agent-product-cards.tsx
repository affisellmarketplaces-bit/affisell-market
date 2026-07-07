"use client"

import Image from "next/image"
import Link from "next/link"
import { Check, Sparkles } from "lucide-react"

import { AffiliateCatalogEconomicsPanel } from "@/components/affiliate/affiliate-catalog-economics-panel"
import type { AffiliateAgentProductCard } from "@/lib/agent-affiliate-product-card-types"
import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

type Props = {
  products: AffiliateAgentProductCard[]
  sectionTitle?: string
  sectionSubtitle?: string
}

function Card({ p }: { p: AffiliateAgentProductCard }) {
  const href = `${AFFILIATE_CATALOG_PATH}?productId=${encodeURIComponent(p.id)}`
  const economics = buildAffiliateCatalogCardEconomics(p.basePriceCents, p.commissionRate)

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-200",
        "border-violet-500/20 bg-gradient-to-b from-zinc-900/90 to-zinc-950 hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-xl hover:shadow-violet-900/25",
        p.isInStore && "ring-1 ring-emerald-500/40"
      )}
    >
      <div className="relative aspect-square w-full bg-zinc-950">
        {p.isInStore ? (
          <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            <Check className="h-3 w-3" aria-hidden />
            En vitrine
          </span>
        ) : (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
            À sourcer
          </span>
        )}
        {p.imageUrl ? (
          <Image
            src={p.imageUrl}
            alt=""
            fill
            className="object-contain p-3 transition duration-300 group-hover:scale-105"
            sizes="240px"
            unoptimized={p.imageUrl.startsWith("http")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">Sans image</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-white">{p.name}</p>
        <p className="truncate text-xs text-zinc-400">{p.supplierLabel}</p>
        <AffiliateCatalogEconomicsPanel economics={economics} variant="compact" tone="dark" />
        <div className="mt-auto rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-center text-xs font-semibold text-white group-hover:from-violet-500 group-hover:to-fuchsia-500">
          {p.isInStore ? "Modifier ma fiche →" : "Ajouter à ma vitrine →"}
        </div>
      </div>
    </Link>
  )
}

export function AffiliateAgentProductCards({ products, sectionTitle, sectionSubtitle }: Props) {
  const list = products.slice(0, 3)
  if (list.length === 0) return null

  return (
    <div className="mt-3">
      {sectionTitle ? (
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" aria-hidden />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-200">{sectionTitle}</h3>
            {sectionSubtitle ? (
              <p className="text-[11px] text-zinc-500">{sectionSubtitle}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {list.map((p) => (
          <Card key={p.id} p={p} />
        ))}
      </div>
    </div>
  )
}
