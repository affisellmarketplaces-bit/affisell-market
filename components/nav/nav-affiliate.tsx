"use client"

import Link from "next/link"
import { Suspense } from "react"

import { NavHeaderSearch } from "@/components/nav/nav-header-search"
import { MerchantAccountNavActions } from "@/components/merchant-account-nav-actions"
import { MerchantNotificationsMenu } from "@/components/merchant-notifications-menu"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Wallet } from "lucide-react"

type Props = {
  showDashboardActions?: boolean
}

export function NavAffiliate({ showDashboardActions = false }: Props) {
  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-1 py-1 text-sm md:flex-nowrap md:gap-4">
      <Link href="/marketplace" className="order-1 shrink-0 text-lg font-bold affisell-logo-text">
        Affisell
      </Link>

      <Suspense fallback={<div className="order-3 h-10 min-w-0 flex-1 md:order-2" aria-hidden />}>
        <div className="order-3 flex min-w-0 flex-1 md:order-2">
          <NavHeaderSearch id="affiliate-header-search-q" placeholder="Search marketplace…" />
        </div>
      </Suspense>

      <div className="order-2 flex shrink-0 flex-wrap items-center gap-4 md:order-3 md:gap-6">
        <Link
          href="/agent"
          className="font-medium text-brand hover:text-brand-hover hover:underline dark:text-brand-light"
        >
          Agent
        </Link>
        <Link href="/marketplace" className="text-zinc-700 hover:underline dark:text-zinc-300">
          Marketplace
        </Link>
        <Link href="/marketplace/account/orders" className="text-zinc-700 hover:underline dark:text-zinc-300">
          Orders
        </Link>
        <Link
          href="/marketplace/account/wallet"
          className="inline-flex items-center gap-1 text-zinc-700 hover:underline dark:text-zinc-300"
        >
          <Wallet className="size-4 shrink-0 opacity-80" aria-hidden />
          Wallet
        </Link>
        <Link href="/cart" className="text-zinc-700 hover:underline dark:text-zinc-300">
          Cart
        </Link>
        {showDashboardActions ? (
          <div className="flex w-full basis-full flex-wrap justify-end gap-2 pt-1 md:ml-auto md:w-auto md:basis-auto md:pt-0">
            <Link
              href="/dashboard/affiliate/earnings"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5 border-violet-200/80 bg-white/90 text-violet-800 hover:bg-violet-50 dark:border-violet-800/60 dark:bg-zinc-900/90 dark:text-violet-200"
              )}
            >
              <Wallet className="size-4 shrink-0" aria-hidden />
              Earnings
            </Link>
            <MerchantNotificationsMenu role="AFFILIATE" />
            <MerchantAccountNavActions />
          </div>
        ) : (
          <MerchantAccountNavActions />
        )}
      </div>
    </nav>
  )
}
