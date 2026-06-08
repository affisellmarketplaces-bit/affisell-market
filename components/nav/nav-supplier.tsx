"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarCheck, Handshake, LayoutDashboard, Package, Rocket, ShoppingCart } from "lucide-react"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { FastLink } from "@/components/navigation/fast-link"
import { NavPill } from "@/components/navigation/nav-pill"
import { QuickNav } from "@/components/navigation/quick-nav"
import { MerchantAccountNavActions } from "@/components/merchant-account-nav-actions"
import { SupplierBookingNavBadge } from "@/components/supplier/supplier-booking-nav-badge"
import { SupplierNotificationsMenu } from "@/components/supplier/supplier-notifications-menu"
import { cn } from "@/lib/utils"

const navScrollClass =
  "flex min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

export function NavSupplier() {
  const t = useTranslations("nav.supplier")
  const pathname = usePathname() ?? ""

  const onDashboard =
    pathname === "/dashboard/supplier" || pathname.startsWith("/dashboard/supplier?")
  const onOrders = pathname.startsWith("/dashboard/supplier/orders")
  const onBookings = pathname.startsWith("/dashboard/supplier/bookings")
  const onProducts = pathname.startsWith("/dashboard/supplier/products")
  const onInviteAffiliate = pathname.startsWith("/dashboard/supplier/invite-affiliate")
  const onPromote = pathname.startsWith("/dashboard/supplier/promote")

  return (
    <nav
      aria-label="Supplier"
      className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-1 py-1 text-sm md:flex-nowrap md:gap-x-3"
    >
      <FastLink href="/dashboard/supplier" className="shrink-0 text-lg font-bold affisell-logo-text">
        Affisell
      </FastLink>
      <span className="shrink-0 rounded-full bg-supplier-muted px-2 py-0.5 text-xs font-semibold text-supplier">
        {t("badge")}
      </span>

      <div className={cn(navScrollClass, "order-4 w-full md:order-none md:min-w-0 md:flex-1")}>
        <NavPill href="/dashboard/supplier" label={t("dashboard")} icon={LayoutDashboard} active={onDashboard} />
        <NavPill href="/dashboard/supplier/orders" label={t("orders")} icon={ShoppingCart} active={onOrders} />
        <SupplierBookingNavBadge>
          {(pendingCount) => (
            <NavPill
              href="/dashboard/supplier/bookings"
              label={t("bookings")}
              icon={CalendarCheck}
              active={onBookings}
              badgeCount={pendingCount}
            />
          )}
        </SupplierBookingNavBadge>
        <NavPill href="/dashboard/supplier/products" label={t("products")} icon={Package} active={onProducts} />
        <NavPill
          href="/dashboard/supplier/promote"
          label="Promote"
          shortLabel="Boost"
          icon={Rocket}
          active={onPromote}
        />
        <NavPill
          href="/dashboard/supplier/invite-affiliate"
          label={t("inviteAffiliate")}
          shortLabel={t("inviteAffiliateShort")}
          icon={Handshake}
          active={onInviteAffiliate}
        />
      </div>

      <div
        className={cn(
          "order-3 flex w-full shrink-0 items-center justify-end gap-2 sm:gap-2.5",
          "border-zinc-200/90 pl-2 md:order-none md:ml-1 md:w-auto md:border-l md:pl-3",
          "dark:border-zinc-700/80"
        )}
      >
        <LocaleSwitcher className="shrink-0" />
        <QuickNav />
        <SupplierNotificationsMenu />
        <MerchantAccountNavActions />
      </div>
    </nav>
  )
}
