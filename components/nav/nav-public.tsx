"use client"

import Link from "next/link"
import { Suspense } from "react"

import { NavHeaderSearch } from "@/components/nav/nav-header-search"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function NavPublic() {
  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-1 py-1 text-sm md:flex-nowrap md:gap-4">
      <Link href="/" className="order-1 shrink-0 text-lg font-bold affisell-logo-text">
        Affisell
      </Link>

      <Suspense fallback={<div className="order-3 h-10 min-w-0 flex-1 md:order-2" aria-hidden />}>
        <div className="order-3 flex min-w-0 flex-1 md:order-2">
          <NavHeaderSearch
            id="public-header-search-q"
            placeholder="Rechercher une boutique…"
            searchTarget="shops"
          />
        </div>
      </Suspense>

      <div className="order-2 flex shrink-0 flex-wrap items-center gap-2 md:order-3 md:gap-3">
        <Link
          href="/auth/signin/affiliate"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-violet-200 text-violet-800")}
        >
          Je suis créateur
        </Link>
        <Link href="/auth/signin" className={cn(buttonVariants({ size: "sm" }))}>
          Connexion
        </Link>
      </div>
    </nav>
  )
}
