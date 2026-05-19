"use client"

import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { type FormEvent, useState } from "react"

import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

export function HeroSearchBar({ className }: Props) {
  const router = useRouter()
  const [q, setQ] = useState("")

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    router.push(
      trimmed
        ? `${PUBLIC_MARKETPLACE_BROWSE_PATH}?q=${encodeURIComponent(trimmed)}`
        : PUBLIC_MARKETPLACE_BROWSE_PATH
    )
  }

  return (
    <form onSubmit={onSubmit} className={cn("relative w-full max-w-2xl", className)}>
      <label htmlFor="home-hero-search" className="sr-only">
        Rechercher un produit
      </label>
      <Search
        className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
        aria-hidden
      />
      <input
        id="home-hero-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un produit, une marque, une niche…"
        className="h-14 w-full rounded-2xl border border-zinc-200/90 bg-white pl-14 pr-28 text-base shadow-lg shadow-violet-500/5 outline-none ring-violet-500/30 transition focus:border-violet-300 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-700"
      >
        Rechercher
      </button>
    </form>
  )
}
