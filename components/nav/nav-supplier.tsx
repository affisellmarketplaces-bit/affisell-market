"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Handshake, LayoutDashboard, Package, ShoppingCart } from "lucide-react"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { FastLink } from "@/components/navigation/fast-link"
import { NavPill } from "@/components/navigation/nav-pill"
import { QuickNav } from "@/components/navigation/quick-nav"
import { MerchantAccountNavActions } from "@/components/merchant-account-nav-actions"
import { SupplierNotificationsMenu } from "@/components/supplier/supplier-notifications-menu"

export function NavSupplier() {
  const t = useTranslations("nav.supplier")
  const pathname = usePathname() ?? ""

  const onDashboard =
    pathname === "/dashboard/supplier" || pathname.startsWith("/dashboard/supplier?")
  const onOrders = pathname.startsWith("/dashboard/supplier/orders")
  const onProducts = pathname.startsWith("/dashboard/supplier/products")
  const onInviteAffiliate = pathname.startsWith("/dashboard/supplier/invite-affiliate")

  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-1 py-1 text-sm md:flex-nowrap md:gap-3">
      <FastLink href="/dashboard/supplier" className="order-1 shrink-0 text-lg font-bold affisell-logo-text">
        Affisell
      </FastLink>
      <span className="order-2 shrink-0 rounded-full bg-supplier-muted px-2 py-0.5 text-xs font-semibold text-supplier">
        {t("badge")}
      </span>

      <div className="order-4 hidden min-w-0 flex-1 items-center gap-1 md:order-3 md:flex">
        <NavPill href="/dashboard/supplier" label={t("dashboard")} icon={LayoutDashboard} active={onDashboard} />
        <NavPill href="/dashboard/supplier/orders" label={t("orders")} icon={ShoppingCart} active={onOrders} />
        <NavPill href="/dashboard/supplier/products" label={t("products")} icon={Package} active={onProducts} />
        <NavPill
          href="/dashboard/supplier/invite-affiliate"
          label={t("inviteAffiliate")}
          icon={Handshake}
          active={onInviteAffiliate}
        />
      </div>

      <div className="order-3 flex w-full flex-wrap items-center justify-end gap-2 md:order-4 md:ml-auto md:w-auto">
        <LocaleSwitcher />
        <QuickNav />
        <SupplierNotificationsMenu />
        <MerchantAccountNavActions />
      </div>
    </nav>
  )
}
