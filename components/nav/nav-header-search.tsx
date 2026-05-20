"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { useTranslations } from "next-intl"
import type { FormEvent } from "react"

import { AFFILIATE_CATALOG_PATH, PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

type Props = {
  id: string
  placeholder?: string
  /** Where unscoped search submits. */
  searchTarget?: "marketplace" | "shops" | "catalog"
}

export function NavHeaderSearch({
  id,
  placeholder,
  searchTarget = "marketplace",
}: Props) {
  const t = useTranslations("nav")
  const resolvedPlaceholder =
    placeholder ?? (searchTarget === "catalog" ? t("searchCatalog") : t("searchProducts"))
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const browseBase =
    searchTarget === "catalog"
      ? AFFILIATE_CATALOG_PATH
      : searchTarget === "shops"
        ? "/shops"
        : PUBLIC_MARKETPLACE_BROWSE_PATH

  function pushWithQuery(base: string, q: string, hash?: string) {
    const params =
      base === "/" && pathname === "/"
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams()
    if (q) params.set("q", q)
    else params.delete("q")
    const qs = params.toString()
    const url = `${base}${qs ? `?${qs}` : ""}${hash ?? ""}`
    router.push(url)
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const q = String(fd.get("q") ?? "").trim()
    if (searchTarget === "shops") {
      router.push(q ? `/shops?q=${encodeURIComponent(q)}` : "/shops")
      return
    }
    if (searchTarget === "catalog") {
      pushWithQuery(AFFILIATE_CATALOG_PATH, q)
      return
    }
    pushWithQuery(PUBLIC_MARKETPLACE_BROWSE_PATH, q)
  }

  const defaultQ =
    searchTarget === "marketplace" &&
      (pathname === "/" || pathname === PUBLIC_MARKETPLACE_BROWSE_PATH)
      ? (searchParams.get("q") ?? "")
      : searchTarget === "catalog" &&
          (pathname === AFFILIATE_CATALOG_PATH || pathname.startsWith(`${AFFILIATE_CATALOG_PATH}/`))
        ? (searchParams.get("q") ?? "")
        : ""

  return (
    <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={onSubmit} role="search">
      <div className="relative flex min-w-0 flex-1 items-center">
        <label htmlFor={id} className="sr-only">
          {t("searchAria")}
        </label>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" aria-hidden />
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultQ}
          placeholder={resolvedPlaceholder}
          autoComplete="off"
          className="h-10 w-full min-w-0 rounded-full border-0 bg-transparent py-2 pl-9 pr-2 text-zinc-900 shadow-none outline-none placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-100"
        />
      </div>
    </form>
  )
}
