"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { LayoutDashboard, Store, Wallet } from "lucide-react"

import { NavHeaderSearch } from "@/components/nav/nav-header-search"
import { MerchantAvatarMenu } from "@/components/nav/merchant-avatar-menu"
import { MerchantNotificationsMenu } from "@/components/merchant-notifications-menu"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

function navLinkClass(active: boolean) {
  return cn(
    "text-sm font-medium transition",
    active
      ? "text-violet-700 underline decoration-violet-500 decoration-2 underline-offset-4 dark:text-violet-300"
      : "text-zinc-700 hover:text-violet-800 hover:underline dark:text-zinc-300 dark:hover:text-violet-200"
  )
}

export function NavAffiliate() {
  const pathname = usePathname() ?? ""

  const onDashboard = pathname.startsWith("/dashboard/affiliate")
  const onMarketplace =
    pathname === AFFILIATE_CATALOG_PATH || pathname.startsWith(`${AFFILIATE_CATALOG_PATH}/`)
  const onAgent = pathname.startsWith("/agent")
  const onEarnings = pathname.startsWith("/dashboard/affiliate/earnings")

  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-1 py-1 text-sm md:flex-nowrap md:gap-4">
      <Link href="/dashboard/affiliate" className="order-1 shrink-0 text-lg font-bold affisell-logo-text">
        Affisell
      </Link>

      <Suspense fallback={<div className="order-3 h-10 min-w-0 flex-1 md:order-2" aria-hidden />}>
        <div className="order-3 flex min-w-0 flex-1 md:order-2">
          <NavHeaderSearch
            id="affiliate-header-search-q"
            placeholder="Rechercher un produit…"
            searchTarget="catalog"
          />
        </div>
      </Suspense>

      <div className="order-2 flex shrink-0 flex-wrap items-center gap-3 md:order-3 md:gap-5">
        <Link href="/agent" className={navLinkClass(onAgent)}>
          Agent
        </Link>
        <Link
          href={AFFILIATE_CATALOG_PATH}
          className={cn(navLinkClass(onMarketplace), "inline-flex items-center gap-1")}
        >
          <Store className="size-4 shrink-0 opacity-80" aria-hidden />
          Catalogue
        </Link>
        <Link
          href="/dashboard/affiliate"
          className={cn(navLinkClass(onDashboard && !onEarnings), "inline-flex items-center gap-1")}
        >
          <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
          Dashboard
        </Link>
        <Link href="/dashboard/affiliate/earnings" className={cn(navLinkClass(onEarnings), "inline-flex items-center gap-1")}>
          <Wallet className="size-4 shrink-0 opacity-80" aria-hidden />
          Revenus
        </Link>
        <MerchantNotificationsMenu role="AFFILIATE" />
        <MerchantAvatarMenu />
      </div>
    </nav>
  )
}
