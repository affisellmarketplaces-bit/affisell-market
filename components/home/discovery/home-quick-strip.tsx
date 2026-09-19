"use client"

import { MapPin } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter, useSearchParams } from "next/navigation"

import { ScrollFadeRow } from "@/components/ui/scroll-fade-row"
import { useVisitorCheckoutRegion } from "@/hooks/use-visitor-checkout-region"
import { categoryPillClass } from "@/lib/category-pill-style"
import { cn } from "@/lib/utils"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { visitorCountryDisplayName } from "@/lib/visitor-country"

type Quick = { id: string; label: string; key: string; value: string }

function scrollToExplorer() {
  window.setTimeout(() => document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
}

/**
 * Amazon-style utility line — but honest: where we deliver (from the visitor's real checkout region) plus
 * one-tap filters that map 1:1 to real catalog facets. Each pill toggles its URL param; the explorer below reacts.
 */
export function HomeQuickStrip() {
  const t = useTranslations("homeQuick")
  const locale = useLocale()
  const router = useRouter()
  const sp = useSearchParams()
  const { country, loading } = useVisitorCheckoutRegion()

  const quick: Quick[] = [
    { id: "free", label: t("freeShipping"), key: "freeShipping", value: "1" },
    { id: "new", label: t("brandNew"), key: "offer", value: "new" },
    { id: "refurb", label: t("refurbished"), key: "offer", value: "refurbished" },
    { id: "used", label: t("secondHand"), key: "offer", value: "second_hand" },
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
      {!loading && country ? (
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/60 dark:bg-white/10 px-3.5 py-2 text-sm font-medium text-[color:var(--glass-text)] ring-1 ring-white/70 backdrop-blur sm:inline-flex">
          <MapPin className="size-4 text-[color:var(--glass-accent)]" aria-hidden />
          {t("deliveringTo", { country: visitorCountryDisplayName(country, locale) })}
        </span>
      ) : null}
      <ScrollFadeRow ariaLabel={t("aria")} className="min-w-0 flex-1">
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
