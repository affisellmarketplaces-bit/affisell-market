import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"

import { auth } from "@/auth"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { buyerSignInHref } from "@/lib/storefront-buyer-links"
import {
  storeBuyerOrderStageIndex,
  type StoreBuyerOrderStage,
} from "@/lib/store-buyer-order-status"
import { loadStoreBuyerOrders, type StoreBuyerOrderRow } from "@/lib/store-buyer-orders.server"

const TIMELINE: readonly StoreBuyerOrderStage[] = ["confirmed", "preparing", "shipped", "delivered"]

type Props = {
  storeSlug: string
  storeName: string
  /** Store accent colour (hex) — falls back to a neutral dark. */
  accent?: string
}

/**
 * "Track my order" on a reseller's own host: the signed-in buyer's orders from THIS store, in the store's
 * branding. Replaces the marketplace page that pointed at the Affisell buyer account.
 */
export async function StoreTrackOrder({ storeSlug, storeName, accent = "#18181b" }: Props) {
  const [t, locale, session] = await Promise.all([
    getTranslations("pages.trackOrder"),
    getLocale(),
    auth(),
  ])
  const email = session?.user?.email?.trim() || null

  let orders: StoreBuyerOrderRow[] = []
  let loadFailed = false
  if (email) {
    try {
      orders = await loadStoreBuyerOrders({ storeSlug, email, buyerUserId: session?.user?.id })
    } catch (error) {
      loadFailed = true
      console.error("[store-track-order]", {
        storeSlug,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("title")}</h1>

      {!email ? (
        <section
          data-testid="store-track-order-signed-out"
          className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {t("store.description", { store: storeName })}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={buyerSignInHref(true)}
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {t("signIn")}
            </Link>
            <Link
              href={`/signup?callbackUrl=${encodeURIComponent("/track-order")}`}
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {t("createAccount")}
            </Link>
          </div>
        </section>
      ) : (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("store.signedInAs", { email })}</p>
      )}

      {email && loadFailed ? (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
        >
          {t("store.loadError")}
        </p>
      ) : null}

      {email && !loadFailed && orders.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{t("store.emptyTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {t("store.emptyBody", { store: storeName })}
          </p>
        </section>
      ) : null}

      {orders.length > 0 ? (
        <ul className="mt-6 space-y-4" data-testid="store-track-order-list">
          {orders.map((order) => {
            const stageIndex = storeBuyerOrderStageIndex(order.stage)
            return (
              <li
                key={order.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-5"
              >
                <div className="flex gap-4">
                  {order.imageUrl ? (
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={order.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {order.productName}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {t("store.orderRef", { ref: order.ref })} · {dateFormat.format(new Date(order.createdAt))} ·{" "}
                      {t("store.quantity", { count: order.quantity })} ·{" "}
                      {formatStoreCurrencyFromCents(order.totalCents)}
                    </p>
                  </div>
                </div>

                {order.stage === "refunded" ? (
                  <p className="mt-4 inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {t("store.stage.refunded")}
                  </p>
                ) : (
                  <ol className="mt-4 grid grid-cols-4 gap-2" aria-label={t("store.stage." + order.stage)}>
                    {TIMELINE.map((step, i) => {
                      const reached = i <= stageIndex
                      return (
                        <li key={step} className="min-w-0">
                          <span
                            className="block h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700"
                            style={reached ? { backgroundColor: accent } : undefined}
                            aria-hidden
                          />
                          <span
                            className={
                              i === stageIndex
                                ? "mt-1.5 block truncate text-[11px] font-semibold text-zinc-900 dark:text-zinc-50"
                                : "mt-1.5 block truncate text-[11px] text-zinc-500 dark:text-zinc-400"
                            }
                          >
                            {t("store.stage." + step)}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                )}

                {order.trackingNumber ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                    <span>
                      {t("store.trackingLabel", {
                        carrier: order.trackingCarrier?.trim() || t("store.defaultCarrier"),
                        number: order.trackingNumber,
                      })}
                    </span>
                    {order.trackingUrl ? (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline-offset-2 hover:underline"
                        style={{ color: accent }}
                      >
                        {t("store.trackParcel")}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-400">{t("store.emailHint", { store: storeName })}</p>
      <Link
        href="/"
        className="mt-4 inline-flex text-sm font-semibold underline-offset-2 hover:underline"
        style={{ color: accent }}
      >
        {t("store.backToStore")}
      </Link>
    </main>
  )
}
