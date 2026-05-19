"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import type { FormEvent } from "react"

type Props = {
  id: string
  placeholder?: string
  /** Where public / unscoped search submits (default: marketplace). */
  searchTarget?: "marketplace" | "shops"
}

export function NavHeaderSearch({
  id,
  placeholder = "Search marketplace…",
  searchTarget = "marketplace",
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const q = String(fd.get("q") ?? "").trim()
    if (searchTarget === "shops") {
      router.push(q ? `/shops?q=${encodeURIComponent(q)}` : "/shops")
      return
    }
    if (pathname === "/marketplace") {
      const params = new URLSearchParams(searchParams.toString())
      if (q) params.set("q", q)
      else params.delete("q")
      const s = params.toString()
      router.push(`/marketplace${s ? `?${s}` : ""}`)
    } else {
      const usp = new URLSearchParams()
      if (q) usp.set("q", q)
      router.push(`/marketplace${usp.toString() ? `?${usp}` : ""}`)
    }
  }

  const defaultQ =
    searchTarget === "marketplace" && pathname === "/marketplace"
      ? (searchParams.get("q") ?? "")
      : ""

  return (
    <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={onSubmit} role="search">
      <div className="relative flex min-w-0 flex-1 items-center">
        <label htmlFor={id} className="sr-only">
          Search
        </label>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" aria-hidden />
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultQ}
          placeholder={placeholder}
          autoComplete="off"
          className="h-10 w-full min-w-0 rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 md:max-w-xl lg:max-w-2xl"
        />
      </div>
    </form>
  )
}
