import Link from "next/link"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowRight, CreditCard, Package, ShoppingCart } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading } from "@/components/affisell/bento-ui"
import { BuyerActiveOrders } from "@/components/buyer/buyer-active-orders"
import { BuyerKpiStrip } from "@/components/buyer/buyer-kpi-strip"
import { BuyerAccountDbNotice } from "@/components/buyer/buyer-account-db-notice"
import { BuyerPushNotificationsCard } from "@/components/buyer/buyer-push-notifications-card"
import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { loadBuyerAccountOverview } from "@/lib/buyer-account-overview"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { translateItemTitles } from "@/lib/title-translation.server"
import type { AppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function MarketplaceBuyerAccountHomePage() {
  const t = await getTranslations("buyerAccount")
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    redirect("/login/customer?callbackUrl=/marketplace/account")
  }

  // A momentarily unreachable database (Neon cold start) must degrade, not crash the whole page.
  const loaded = await loadBuyerAccountOverview(session.user.id, session.user.email).then(
    (overview) => ({ ok: true as const, overview }),
    (error: unknown) => {
      console.error("[buyer-account-page]", {
        userId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false as const }
    }
  )
  if (!loaded.ok) {
    return (
      <BentoContainer maxWidth="4xl" className="space-y-8">
        <BentoPageHeading
          eyebrow={t("welcomeEyebrow")}
          title={t("hubTitle")}
          description={t("hubSubtitle")}
          className="max-w-2xl"
        />
        <BuyerAccountDbNotice />
      </BentoContainer>
    )
  }
  const { overview } = loaded
  const walletLabel = formatStoreCurrencyFromCents(overview.walletCents)
  const locale = await getLocale()
  const tStatus = await getTranslations("buyerOrderDetail.status")
  const activeOrders = await translateItemTitles(
    overview.activeOrders.map((o) => ({ ...o, name: o.title })),
    locale as AppLocale
  ).then((rows) => rows.map((o) => ({ ...o, title: o.name })))
  const statusKey = (status: string) =>
    ["paid", "preparing", "shipped", "refunded", "cancelled"].includes(status) ? status : "unknown"

  return (
    <BentoContainer maxWidth="4xl" className="space-y-8">
      <div className="space-y-4">
        <BentoPageHeading
          eyebrow={t("welcomeEyebrow")}
          title={t("hubTitle")}
          description={t("hubSubtitle")}
          className="max-w-2xl"
        />
        <Link
          href="/#explorer"
          className={cn(
            buttonVariants({ variant: "bentoAccent", size: "bento" }),
            "inline-flex w-full justify-center sm:w-auto"
          )}
        >
          {t("browseMarketplace")}
        </Link>
      </div>

      {overview.orderCount > 0 || overview.cartItemCount > 0 || overview.walletCents > 0 ? (
        <BuyerKpiStrip
          labels={{
            inProgress: t("kpiInProgress"),
            delivered: t("kpiDelivered"),
            credit: t("kpiCredit"),
            cart: t("kpiCart"),
            inProgressSub: t("kpiInProgressSub"),
            deliveredSub: t("kpiDeliveredSub"),
            creditSub: t("kpiCreditSub"),
            cartSub: t("kpiCartSub"),
          }}
          inProgressCount={overview.inProgressCount}
          deliveredCount={overview.deliveredCount}
          walletLabel={walletLabel}
          walletCents={overview.walletCents}
          cartItemCount={overview.cartItemCount}
        />
      ) : null}

      <BuyerActiveOrders
        orders={activeOrders}
        locale={locale}
        labels={{
          title: t("activeTitle"),
          viewAll: t("activeViewAll"),
          details: t("activeDetails"),
          track: t("activeTrack"),
          ordered: (date) => t("activeOrdered", { date }),
          status: (status) => tStatus(statusKey(status)),
        }}
      />

      <div className="grid gap-4">
        {overview.orderCount === 0 ? (
          <BentoCard className="relative overflow-hidden border-violet-200/60 p-6 dark:border-violet-900/40 sm:col-span-2">
            <Package className="size-8 text-violet-600 dark:text-violet-400" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">{t("noOrders")}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("noOrdersHint")}</p>
            <Link
              href="/#explorer"
              className={cn(
                buttonVariants({ variant: "bentoAccent", size: "bento" }),
                "mt-6 inline-flex w-full justify-center gap-2 sm:w-auto"
              )}
            >
              {t("discoverProducts")} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </BentoCard>
        ) : null}

        <BentoCard className="relative overflow-hidden border-emerald-200/60 p-6 dark:border-emerald-900/40">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl dark:bg-emerald-600/15"
            aria-hidden
          />
          <CreditCard className="size-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">{t("walletTitle")}</h2>
          <p className="mt-2 text-sm font-medium tabular-nums text-zinc-900 dark:text-white">
            {t("walletAvailable", { amount: walletLabel })}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("walletBody")}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/marketplace/account/wallet"
              className={cn(
                buttonVariants({ variant: "bentoOutline", size: "bento" }),
                "inline-flex justify-center gap-2"
              )}
            >
              {t("viewWallet")} <ArrowRight className="size-4" aria-hidden />
            </Link>
            {overview.walletCents === 0 ? (
              <Link
                href="/faq#cashback"
                className="text-center text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300 sm:text-left"
              >
                {t("cashbackFaq")}
              </Link>
            ) : null}
          </div>
        </BentoCard>
      </div>

      <BuyerPushNotificationsCard />

      {overview.cartItemCount === 0 ? (
        <BentoCard className="flex flex-col gap-4 border-dashed border-violet-200/80 bg-violet-50/40 p-6 dark:border-violet-800/50 dark:bg-violet-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
              <ShoppingCart className="size-6 text-violet-600 dark:text-violet-400" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("cartEmptyTitle")}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("cartEmptyBody")}</p>
            </div>
          </div>
          <Link
            href="/#explorer"
            className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }), "inline-flex justify-center")}
          >
            {t("startShopping")}
          </Link>
        </BentoCard>
      ) : (
        <BentoCard className="flex flex-col gap-4 border-dashed border-violet-200/80 bg-violet-50/40 p-6 dark:border-violet-800/50 dark:bg-violet-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
              <ShoppingCart className="size-6 text-violet-600 dark:text-violet-400" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("cartTitle")}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("cartPending", { count: overview.cartItemCount })}
              </p>
            </div>
          </div>
          <Link href="/cart" className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex justify-center")}>
            {t("viewCart")}
          </Link>
        </BentoCard>
      )}

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/marketplace/account/gdpr"
          className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-400"
        >
          {t("gdprCta")}
        </Link>
        {" · "}
        <Link
          href="/#explorer"
          className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-400"
        >
          {t("backMarketplace")}
        </Link>
      </p>
    </BentoContainer>
  )
}
