"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarCheck, Flame, Handshake, Layers, LayoutDashboard, Package, Rocket, ShoppingCart, Sparkles, Truck } from "lucide-react"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { FastLink } from "@/components/navigation/fast-link"
import { NavPill } from "@/components/navigation/nav-pill"
import { QuickNav } from "@/components/navigation/quick-nav"
import { MerchantAccountNavActions } from "@/components/merchant-account-nav-actions"
import { MerchantAvatarMenu } from "@/components/nav/merchant-avatar-menu"
import { RadarNavPill } from "@/components/radar/radar-nav-pill"
import { SupplierBookingNavBadge } from "@/components/supplier/supplier-booking-nav-badge"
import { SupplierNotificationsMenu } from "@/components/supplier/supplier-notifications-menu"
import { isPartnerDockRoute } from "@/lib/partner-mobile-nav"
import { DROPFORGE_HREF } from "@/lib/affiliate-onboarding-shared"
import { MAGIC_SYSTEMS_HREF } from "@/lib/magic-systems-catalog"
import { cn } from "@/lib/utils"

const navScrollClass =
  "flex min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

export function NavSupplier() {
  const t = useTranslations("nav.supplier")
  const tDock = useTranslations("partnerDock")
  const pathname = usePathname() ?? ""

  const dockActive = isPartnerDockRoute(pathname)
  const onDashboard =
    pathname === "/dashboard/supplier" || pathname.startsWith("/dashboard/supplier?")
  const onOrders = pathname.startsWith("/dashboard/supplier/orders")
  const onBookings = pathname.startsWith("/dashboard/supplier/bookings")
  const onProducts = pathname.startsWith("/dashboard/supplier/products")
  const onInviteAffiliate = pathname.startsWith("/dashboard/supplier/invite-affiliate")
  const onShipping = pathname.startsWith("/dashboard/supplier/settings/shipping")
  const onPromote = pathname.startsWith("/dashboard/supplier/promote")
  const onDropForge = pathname === DROPFORGE_HREF || pathname.startsWith(`${DROPFORGE_HREF}?`)
  const onSupply =
    pathname === "/dashboard/supplier/supply" ||
    pathname.startsWith("/dashboard/supplier/supply?")
  const onLab = pathname === MAGIC_SYSTEMS_HREF || pathname.startsWith(`${MAGIC_SYSTEMS_HREF}/`)

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

      <div
        className={cn(
          navScrollClass,
          "order-4 w-full md:order-none md:min-w-0 md:flex-1",
          dockActive && "max-md:hidden"
        )}
      >
        <NavPill href="/dashboard/supplier" label={t("dashboard")} icon={LayoutDashboard} active={onDashboard} />
        <NavPill
          href="/dashboard/supplier/supply#affisell-stock"
          label={t("supply")}
          shortLabel={t("supplyShort")}
          icon={Layers}
          active={onSupply}
        />
        <NavPill
          href={DROPFORGE_HREF}
          label={t("dropforge")}
          shortLabel={t("dropforgeShort")}
          icon={Flame}
          active={onDropForge}
        />
        <NavPill
          href={MAGIC_SYSTEMS_HREF}
          label={t("magicLab")}
          shortLabel={t("magicLabShort")}
          icon={Sparkles}
          active={onLab}
        />
        <RadarNavPill variant="supplier" />
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
        <NavPill href="/dashboard/supplier/settings/shipping" label={t("shipping")} icon={Truck} active={onShipping} />
        <NavPill
          href="/dashboard/supplier/promote"
          label={tDock("promote")}
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
          "order-3 ml-auto flex shrink-0 items-center justify-end gap-2 sm:gap-2.5",
          "border-zinc-200/90 pl-2 md:order-none md:ml-1 md:border-l md:pl-3",
          "dark:border-zinc-700/80"
        )}
      >
        <LocaleSwitcher className="shrink-0" />
        <span className="hidden md:inline-flex">
          <QuickNav />
        </span>
        <SupplierNotificationsMenu />
        <MerchantAccountNavActions className="hidden md:flex" />
        <MerchantAvatarMenu className="md:hidden" />
      </div>
    </nav>
  )
}
