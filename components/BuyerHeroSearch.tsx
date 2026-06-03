"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { type FormEvent, useState } from "react"

export function BuyerHeroSearch() {
  const t = useTranslations("home.hero")
  const router = useRouter()
  const [q, setQ] = useState("")

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    const base = "/marketplace"
    router.push(
      trimmed ? `${base}?q=${encodeURIComponent(trimmed)}` : base
    )
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <label htmlFor="buyer-hero-search" className="sr-only">
        {t("searchLabel")}
      </label>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" aria-hidden />
      <input
        id="buyer-hero-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="h-12 w-full min-w-0 rounded-2xl border border-white/25 bg-white/95 pl-11 pr-[4.75rem] text-base text-zinc-900 shadow-lg outline-none focus:ring-4 focus:ring-[#6366F1]/40 sm:h-14 sm:pl-12 sm:pr-28 dark:bg-zinc-950 dark:text-zinc-50"
      />
      <kbd className="pointer-events-none absolute right-[4.25rem] top-1/2 hidden -translate-y-1/2 rounded border bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 md:inline">
        ⌘K
      </kbd>
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 flex h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[#6366F1] px-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#5558E3] sm:right-2 sm:h-10 sm:min-w-0 sm:px-5"
        aria-label={t("searchSubmit")}
      >
        <Search className="h-4 w-4 sm:hidden" aria-hidden />
        <span className="hidden sm:inline">{t("searchSubmit")}</span>
      </button>
    </form>
  )
}
