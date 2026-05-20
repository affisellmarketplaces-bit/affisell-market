"use client"

import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { useTranslations } from "next-intl"
import { LayoutDashboard, Store, Wallet } from "lucide-react"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { FastLink } from "@/components/navigation/fast-link"
import { NavPill } from "@/components/navigation/nav-pill"
import { QuickNav } from "@/components/navigation/quick-nav"
import { NavHeaderSearch } from "@/components/nav/nav-header-search"
import { MerchantAvatarMenu } from "@/components/nav/merchant-avatar-menu"
import { MerchantNotificationsMenu } from "@/components/merchant-notifications-menu"
import { AFFILIATE_AGENT_PATH, AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"

export function NavAffiliate() {
  const t = useTranslations("nav.affiliate")
  const tSearch = useTranslations("nav")
  const pathname = usePathname() ?? ""

  const onAgent = pathname.startsWith(AFFILIATE_AGENT_PATH)
  const onCatalog =
    pathname === AFFILIATE_CATALOG_PATH || pathname.startsWith(`${AFFILIATE_CATALOG_PATH}/`)
  const onEarnings = pathname.startsWith("/dashboard/affiliate/earnings")
  const onDashboard =
    pathname === "/dashboard/affiliate" ||
    (pathname.startsWith("/dashboard/affiliate/") &&
      !onEarnings &&
      !onCatalog &&
      !onAgent)
  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-1 py-1 text-sm md:flex-nowrap md:gap-3">
      <FastLink href="/dashboard/affiliate" className="order-1 shrink-0 text-lg font-bold affisell-logo-text">
        Affisell
      </FastLink>

      <div className="order-3 hidden min-w-0 flex-1 items-center gap-1 md:order-2 md:flex">
        <NavPill href={AFFILIATE_AGENT_PATH} label={t("agent")} active={onAgent} />
        <NavPill href={AFFILIATE_CATALOG_PATH} label={t("catalog")} icon={Store} active={onCatalog} />
        <NavPill href="/dashboard/affiliate" label={t("dashboard")} icon={LayoutDashboard} active={onDashboard} />
        <NavPill href="/dashboard/affiliate/earnings" label={t("earnings")} icon={Wallet} active={onEarnings} />
      </div>

      <Suspense fallback={<div className="order-4 h-10 min-w-0 flex-1 md:order-3" aria-hidden />}>
        <div className="order-4 flex min-w-0 flex-1 md:order-3">
          <NavHeaderSearch
            id="affiliate-header-search-q"
            placeholder={tSearch("searchCatalog")}
            searchTarget="catalog"
          />
        </div>
      </Suspense>

      <div className="order-2 flex shrink-0 flex-wrap items-center gap-2 md:order-4 md:gap-3">
        <LocaleSwitcher />
        <QuickNav />
        <MerchantNotificationsMenu role="AFFILIATE" />
        <MerchantAvatarMenu />
      </div>
    </nav>
  )
}
