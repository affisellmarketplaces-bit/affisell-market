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
import { cn } from "@/lib/utils"

const navScrollClass =
  "flex min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

const searchShellClass = cn(
  "flex w-full min-w-0 items-center rounded-full border border-zinc-200/90 bg-zinc-50/95 pl-1 shadow-sm",
  "ring-violet-500/10 transition-[box-shadow] focus-within:border-violet-300/80 focus-within:ring-2 focus-within:ring-violet-500/25",
  "dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:focus-within:border-violet-500/50"
)

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
    (pathname.startsWith("/dashboard/affiliate/") && !onEarnings && !onCatalog && !onAgent)

  return (
    <nav
      aria-label="Affiliate"
      className={cn(
        "mx-auto grid w-full max-w-7xl items-center gap-x-2 gap-y-2 px-1 py-1 text-sm",
        "grid-cols-[auto_1fr_auto]",
        "md:gap-x-3",
        "lg:grid-cols-[auto_minmax(0,1fr)_minmax(10rem,14rem)_auto]",
        "xl:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,18rem)_auto]",
        "xl:gap-x-3"
      )}
    >
      <FastLink
        href="/dashboard/affiliate"
        className="col-start-1 row-start-1 shrink-0 text-lg font-bold affisell-logo-text"
      >
        Affisell
      </FastLink>

      <div
        className={cn(
          navScrollClass,
          "col-span-3 col-start-1 row-start-2",
          "lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:max-w-full lg:overflow-visible"
        )}
      >
        <NavPill href={AFFILIATE_AGENT_PATH} label={t("agent")} shortLabel={t("agentShort")} active={onAgent} />
        <NavPill
          href={AFFILIATE_CATALOG_PATH}
          label={t("catalog")}
          icon={Store}
          active={onCatalog}
        />
        <NavPill
          href="/dashboard/affiliate"
          label={t("dashboard")}
          shortLabel={t("dashboardShort")}
          icon={LayoutDashboard}
          active={onDashboard}
        />
        <NavPill
          href="/dashboard/affiliate/earnings"
          label={t("earnings")}
          shortLabel={t("earningsShort")}
          icon={Wallet}
          active={onEarnings}
        />
      </div>

      <Suspense
        fallback={
          <div
            className="col-span-3 col-start-1 row-start-3 h-10 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1"
            aria-hidden
          />
        }
      >
        <div
          className={cn(
            "col-span-3 col-start-1 row-start-3 flex min-w-0",
            "lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:justify-stretch"
          )}
        >
          <div className={searchShellClass}>
            <NavHeaderSearch
              id="affiliate-header-search-q"
              placeholder={tSearch("searchCatalog")}
              searchTarget="catalog"
            />
          </div>
        </div>
      </Suspense>

      <div
        className={cn(
          "col-start-3 row-start-1 flex shrink-0 items-center justify-end gap-1.5 sm:gap-2",
          "lg:col-start-4 lg:gap-2.5"
        )}
      >
        <LocaleSwitcher />
        <QuickNav />
        <MerchantNotificationsMenu role="AFFILIATE" />
        <MerchantAvatarMenu />
      </div>
    </nav>
  )
}
