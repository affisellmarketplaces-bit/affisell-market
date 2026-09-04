"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { type FormEvent, useState } from "react"

import { navigateBuyerHomeCatalog } from "@/lib/marketplace-catalog-nav.client"
import { BUYER_PREMIUM, buyerPremiumCtaClass } from "@/lib/buyer-premium-home-tokens"
import { cn } from "@/lib/utils"

type Props = {
  premium?: boolean
}

export function BuyerHeroSearch({ premium = false }: Props) {
  const t = useTranslations("home.hero")
  const router = useRouter()
  const [q, setQ] = useState("")

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    navigateBuyerHomeCatalog(router, trimmed ? { q: trimmed } : undefined)
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <label htmlFor="buyer-hero-search" className="sr-only">
        {t("searchLabel")}
      </label>
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
        aria-hidden
      />
      <input
        id="buyer-hero-search"
        name="q"
        type="search"
        enterKeyHint="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={premium ? t("searchPlaceholderPremium") : t("searchPlaceholder")}
        className={cn(
          "h-12 w-full min-w-0 rounded-full border border-white bg-white pl-11 text-sm outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-[rgba(67,56,202,0.18)] sm:h-14 sm:text-base dark:text-zinc-50",
          premium ? "pr-[9.5rem] sm:pr-[11.5rem]" : "pr-[4.75rem] sm:pr-28"
        )}
        style={
          premium
            ? {
                color: BUYER_PREMIUM.text.heading,
                boxShadow: BUYER_PREMIUM.search.shadow,
                // focus ring via CSS variable on parent form would be heavy — ring class below
              }
            : undefined
        }
      />
      {!premium ? (
        <kbd className="pointer-events-none absolute right-[4.25rem] top-1/2 hidden -translate-y-1/2 rounded border bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 md:inline">
          ⌘K
        </kbd>
      ) : null}
      <button
        type="submit"
        className={cn(
          "absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full font-semibold text-white transition-all duration-200 active:scale-95",
          premium
            ? cn("h-10 rounded-full px-4 text-xs sm:h-11 sm:px-5 sm:text-sm", buyerPremiumCtaClass)
            : "affisell-premium-cta h-11 min-w-11 rounded-[1.05rem] px-3 text-sm sm:right-2 sm:h-10 sm:min-w-0 sm:px-5"
        )}
        aria-label={premium ? t("searchSubmitPremium") : t("searchSubmit")}
      >
        {premium ? (
          <span>{t("searchSubmitPremium")}</span>
        ) : (
          <>
            <Search className="h-4 w-4 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">{t("searchSubmit")}</span>
          </>
        )}
      </button>
    </form>
  )
}
