"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CreditCard, LayoutDashboard, Package, ShoppingCart } from "lucide-react"

import { cn } from "@/lib/utils"

type TabKey = "overview" | "orders" | "wallet" | "cart"

const TAB_DEFS: Array<{
  key: TabKey
  href: string
  baseLabel: string
  icon: typeof LayoutDashboard
  exact: boolean
}> = [
  { key: "overview", href: "/marketplace/account", baseLabel: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { key: "orders", href: "/marketplace/account/orders", baseLabel: "Commandes", icon: Package, exact: false },
  { key: "wallet", href: "/marketplace/account/wallet", baseLabel: "Portefeuille", icon: CreditCard, exact: false },
  { key: "cart", href: "/cart", baseLabel: "Panier", icon: ShoppingCart, exact: false },
]

function tabLabel(
  key: TabKey,
  baseLabel: string,
  orderCount: number,
  cartItemCount: number
): string {
  if (key === "orders") return `${baseLabel} (${orderCount})`
  if (key === "cart") return `${baseLabel} (${cartItemCount})`
  return baseLabel
}

type Props = {
  orderCount?: number
  cartItemCount?: number
}

export function BuyerAccountNav({ orderCount = 0, cartItemCount = 0 }: Props) {
  const pathname = usePathname() ?? ""

  return (
    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Espace client">
      {TAB_DEFS.map(({ key, href, baseLabel, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
        const label = tabLabel(key, baseLabel, orderCount, cartItemCount)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition",
              active
                ? "border-violet-500 bg-violet-600 text-white hover:bg-violet-700 dark:border-violet-400 dark:bg-violet-600"
                : "border-zinc-200/90 bg-white/90 text-zinc-800 hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-violet-600 dark:hover:text-violet-200"
            )}
          >
            <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
