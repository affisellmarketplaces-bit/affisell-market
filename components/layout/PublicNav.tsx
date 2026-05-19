"use client"

import { Suspense } from "react"
import { Home, Search, Store } from "lucide-react"
import { usePathname } from "next/navigation"

import { FastLink } from "@/components/navigation/fast-link"
import { NavPill } from "@/components/navigation/nav-pill"
import { QuickNav } from "@/components/navigation/quick-nav"
import { NavHeaderSearch } from "@/components/nav/nav-header-search"
import { PUBLIC_MARKETPLACE_BROWSE_PATH, PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PublicNav() {
  const pathname = usePathname() ?? ""

  const onHome = pathname === "/"
  const onShops =
    pathname === PUBLIC_SHOPS_PATH ||
    (pathname.startsWith("/shops/") && !pathname.includes("/product/"))
  const onMarketplace = pathname === "/" || pathname === PUBLIC_MARKETPLACE_BROWSE_PATH

  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-1 py-1 text-sm md:flex-nowrap md:gap-3">
      <FastLink href="/" className="order-1 shrink-0 text-lg font-bold affisell-logo-text">
        Affisell
      </FastLink>

      <div className="order-3 hidden min-w-0 flex-1 items-center gap-1 md:order-2 md:flex">
        <NavPill href="/" label="Accueil" icon={Home} active={onHome} />
        <NavPill href={PUBLIC_SHOPS_PATH} label="Boutiques" icon={Store} active={onShops} />
        <NavPill href="/#explorer" label="Marketplace" icon={Search} active={onMarketplace} />
      </div>

      <Suspense fallback={<div className="order-4 h-10 min-w-0 flex-1 md:order-3" aria-hidden />}>
        <div className="order-4 flex min-w-0 flex-1 md:order-3">
          <NavHeaderSearch
            id="public-header-search-q"
            placeholder="Rechercher un produit…"
            searchTarget="marketplace"
          />
        </div>
      </Suspense>

      <div className="order-2 flex shrink-0 flex-wrap items-center gap-2 md:order-4">
        <QuickNav />
        <FastLink
          href="/signup/affiliate"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden border-violet-200 text-violet-800 sm:inline-flex")}
        >
          Créateur
        </FastLink>
        <FastLink href="/login" className={cn(buttonVariants({ size: "sm" }))}>
          Connexion
        </FastLink>
      </div>
    </nav>
  )
}
