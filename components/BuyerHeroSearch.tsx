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
        className="h-14 w-full rounded-2xl border border-white/25 bg-white/95 pl-12 pr-28 text-base text-zinc-900 shadow-lg outline-none focus:ring-4 focus:ring-[#6366F1]/40 dark:bg-zinc-950 dark:text-zinc-50"
      />
      <kbd className="pointer-events-none absolute right-[5.5rem] top-1/2 hidden -translate-y-1/2 rounded border bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline">
        ⌘K
      </kbd>
      <button
        type="submit"
        className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-[#6366F1] px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#5558E3]"
      >
        {t("searchSubmit")}
      </button>
    </form>
  )
}
