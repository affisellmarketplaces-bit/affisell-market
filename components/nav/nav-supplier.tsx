"use client"

import Link from "next/link"

import { MerchantAccountNavActions } from "@/components/merchant-account-nav-actions"
import { SupplierNotificationsMenu } from "@/components/supplier/supplier-notifications-menu"

export function NavSupplier() {
  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-1 py-1 text-sm md:flex-nowrap md:gap-4">
      <Link
        href="/dashboard/supplier"
        className="order-1 shrink-0 text-lg font-bold affisell-logo-text"
      >
        Affisell
      </Link>
      <span className="order-2 shrink-0 rounded-full bg-supplier-muted px-2 py-0.5 text-xs font-semibold text-supplier">
        Fournisseur
      </span>
      <div className="order-3 flex w-full flex-wrap items-center justify-end gap-2 md:ml-auto md:w-auto">
        <Link
          href="/dashboard/supplier"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Dashboard
        </Link>
        <Link
          href="/dashboard/supplier/orders"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Commandes
        </Link>
        <Link
          href="/dashboard/supplier/products"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Produits
        </Link>
        <SupplierNotificationsMenu />
        <MerchantAccountNavActions />
      </div>
    </nav>
  )
}
