"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { MarketplaceShipsToChip } from "@/components/marketplace/marketplace-ships-to-chip"
import { ScrollFadeRow } from "@/components/ui/scroll-fade-row"
import { categoryPillClass } from "@/lib/category-pill-style"
import { cn } from "@/lib/utils"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"

type Quick = { id: string; label: string; key: string; value: string }

function scrollToExplorer() {
  window.setTimeout(() => document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
}

/**
 * Amazon-style utility line — but honest: a "Ships to <country>" filter from the visitor's real checkout region plus
 * one-tap filters that map 1:1 to real catalog facets. Condition filters live in the counted condition bar below.
 */
export function HomeQuickStrip() {
  const t = useTranslations("homeQuick")
  const router = useRouter()
  const sp = useSearchParams()

  const quick: Quick[] = [
    { id: "free", label: t("freeShipping"), key: "freeShipping", value: "1" },
    { id: "u20", label: t("under", { amount: "20 €" }), key: "price", value: "under20" },
    { id: "u50", label: t("under", { amount: "50 €" }), key: "price", value: "under50" },
  ]

  function toggle(q: Quick) {
    const params = new URLSearchParams(sp.toString())
    if (params.get(q.key) === q.value) params.delete(q.key)
    else params.set(q.key, q.value)
    router.push(catalogFilterHref("/", params.toString()), { scroll: false })
    scrollToExplorer()
  }

  return (
    <div className="flex min-w-0 items-center gap-2" role="region" aria-label={t("aria")}>
      {/* Interactive "Ships to <country>" filter (hidden until the visitor's checkout region is known). */}
      <MarketplaceShipsToChip
        basePath="/"
        className="shrink-0 !bg-white/60 !py-2 !text-sm !text-[color:var(--glass-text)] !ring-white/70 max-lg:min-h-11 dark:!bg-white/10"
      />
      <ScrollFadeRow ariaLabel={t("aria")} className="min-w-0 flex-1">
        <Link href="/battles" className={cn(categoryPillClass(false), "max-lg:min-h-11")}>
          ⚡ {t("flash")}
        </Link>
        {quick.map((q) => {
          const active = sp.get(q.key) === q.value
          return (
            <button
              key={q.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(q)}
              // 44px touch target on phones and tablets, compact on desktop.
              className={cn(categoryPillClass(active), "max-lg:min-h-11")}
            >
              {q.label}
            </button>
          )
        })}
      </ScrollFadeRow>
    </div>
  )
}
