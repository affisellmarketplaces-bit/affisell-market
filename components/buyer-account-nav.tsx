"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CreditCard, LayoutDashboard, Package, ShoppingCart } from "lucide-react"

import { cn } from "@/lib/utils"

const tabs = [
  { href: "/marketplace/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/marketplace/account/orders", label: "Orders", icon: Package, exact: false },
  { href: "/marketplace/account/wallet", label: "Wallet", icon: CreditCard, exact: false },
  { href: "/cart", label: "Cart", icon: ShoppingCart, exact: false },
] as const

export function BuyerAccountNav() {
  const pathname = usePathname() ?? ""

  return (
    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Buyer account">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href + label}
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
