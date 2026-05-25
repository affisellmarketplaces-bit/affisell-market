import Link from "next/link"
import { CheckCircle2, Plus } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { SupplierUrgentCarousel } from "@/components/supplier/mission-control/supplier-urgent-carousel"
import type { SupplierUrgentSnapshot } from "@/lib/supplier-urgent-snapshot"
import { formatMoneyFromCents } from "@/lib/app-locale-format"
import type { AppLocale } from "@/lib/i18n-locale"
import {
  formatSlaCountdown,
  SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS,
} from "@/lib/supplier-ship-sla-shared"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  urgent: SupplierUrgentSnapshot
  locale: AppLocale
}

type TFn = Awaited<ReturnType<typeof getTranslations<"supplierDashboard.urgent">>>

type SlotProps = {
  active: boolean
  title: string
  titleSubline?: string
  metric: string
  consequence: string
  href: string
  cta: string
  tone: "amber" | "red" | "violet" | "zinc"
  ctaVariant?: "default" | "outline"
}

const toneRing: Record<SlotProps["tone"], string> = {
  amber: "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
  red: "border-red-200/80 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20",
  violet: "border-violet-200/80 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20",
  zinc: "border-zinc-200/80 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30",
}

function UrgentSlot({
  active,
  title,
  titleSubline,
  metric,
  consequence,
  href,
  cta,
  tone,
  ctaVariant = "outline",
}: SlotProps) {
  return (
    <article
      className={cn(
        "flex min-h-[9.5rem] flex-col gap-3 rounded-2xl border p-4 shadow-sm",
        active ? toneRing[tone] : toneRing.zinc
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h3
          className={cn(
            "text-sm font-semibold leading-snug",
            active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500"
          )}
        >
          {title}
          {active && titleSubline ? (
            <span
              className={cn(
                "mt-0.5 block text-xs font-bold",
                tone === "red"
                  ? "text-red-700 dark:text-red-300"
                  : "text-amber-700 dark:text-amber-300"
              )}
            >
              {titleSubline}
            </span>
          ) : null}
        </h3>
        <p
          className={cn(
            "text-xs font-medium",
            active ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
          )}
        >
          {metric}
        </p>
        <p
          className={cn(
            "text-xs",
            active ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400/80 dark:text-zinc-600"
          )}
        >
          {consequence}
        </p>
      </div>
      {active ? (
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant: ctaVariant, size: "sm" }),
            ctaVariant === "default" &&
              tone === "amber" &&
              "w-fit bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600",
            ctaVariant === "default" &&
              tone === "red" &&
              "w-fit bg-red-600 text-white hover:bg-red-700 dark:bg-red-600",
            ctaVariant === "default" &&
              tone === "violet" &&
              "w-fit bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600",
            ctaVariant === "outline" && "w-fit border-zinc-300/80 bg-white/80 dark:bg-zinc-950/80"
          )}
        >
          {cta}
        </Link>
      ) : (
        <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
      )}
    </article>
  )
}

function formatHoursLeftLabelLocalized(hoursLeft: number, t: TFn): string {
  if (hoursLeft <= 0) return t("slaBreached")
  const h = Math.floor(hoursLeft)
  const m = Math.round((hoursLeft - h) * 60)
  if (h >= 1) return t("hoursLeftUnder", { hours: h })
  return m > 0 ? t("hoursLeftMinutes", { minutes: m }) : t("hoursLeftUnderOne")
}

function buildShipSlot(urgent: SupplierUrgentSnapshot, t: TFn, locale: AppLocale): SlotProps {
  const active = urgent.ordersToShip > 0
  const hoursLeft = urgent.ordersToShipHoursLeft
  const late = urgent.ordersToShipSlaLate
  const urgentSla = urgent.ordersToShipSlaUrgent
  const remainingMs =
    urgent.ordersToShipSlaMs != null && urgent.ordersToShipSlaMs > 0
      ? urgent.ordersToShipSlaMs
      : null

  const countTitle =
    urgent.ordersToShip === 1
      ? t("shipTitleOne")
      : t("shipTitleMany", { count: urgent.ordersToShip })

  const penaltyPerOrder = formatMoneyFromCents(
    urgent.ordersToShipPenaltyPerOrderCents || SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS,
    locale
  )

  return {
    active,
    title: countTitle,
    titleSubline:
      active && hoursLeft != null && !late
        ? formatHoursLeftLabelLocalized(hoursLeft, t)
        : active && late
          ? t("slaBreached")
          : undefined,
    metric: !active
      ? t("metricNonePending")
      : late
        ? t("metricPaidLate")
        : remainingMs != null
          ? t("metricPaidSlaIn", { countdown: formatSlaCountdown(remainingMs) })
          : t("metricPaidWaiting"),
    consequence:
      active && (urgentSla || late)
        ? t("penaltyPerOrder", { amount: penaltyPerOrder })
        : active
          ? t("buyerRatingRisk")
          : "—",
    href: "/dashboard/supplier/orders",
    cta: t("ctaShip"),
    tone: urgentSla || late ? "red" : "amber",
    ctaVariant: active ? "default" : "outline",
  }
}

function buildStockSlot(urgent: SupplierUrgentSnapshot, t: TFn): SlotProps {
  const active = urgent.lowStockCount > 0
  const first = urgent.lowStockLines[0]
  const extra = urgent.lowStockCount > 1 ? urgent.lowStockCount - 1 : 0

  const title = active
    ? urgent.lowStockCount === 1
      ? t("stockTitleOne")
      : t("stockTitleMany", { count: urgent.lowStockCount })
    : t("stockTitleIdle")

  const skuLabel = first
    ? extra > 0
      ? `SKU ${first.label} · +${extra}`
      : `SKU ${first.label}`
    : "—"

  const stockLine =
    first != null
      ? first.stock <= 0
        ? t("stockZero")
        : first.stock > 1
          ? t("stockRemainingMany", { count: first.stock })
          : t("stockRemainingOne", { count: first.stock })
      : "—"

  const restockHref = first
    ? `/dashboard/supplier/products/${first.productId}${first.variantId ? "#add-product-variants" : ""}`
    : "/dashboard/supplier/products"

  return {
    active,
    title,
    metric: active ? skuLabel : t("stockOk"),
    consequence: active ? stockLine : "—",
    href: restockHref,
    cta: t("ctaRestock"),
    tone: first != null && first.stock <= 0 ? "red" : "amber",
    ctaVariant: active ? "default" : "outline",
  }
}

function buildMessageSlot(urgent: SupplierUrgentSnapshot, t: TFn): SlotProps {
  const active = urgent.clientMessagesCount > 0
  const n = urgent.clientMessagesCount

  return {
    active,
    title: active
      ? n === 1
        ? t("messagesTitleOne")
        : t("messagesTitleMany", { count: n })
      : t("messagesTitleIdle"),
    metric: active ? t("metricNoReply") : t("metricInboxClear"),
    consequence: active
      ? urgent.shopRatingImpactPct > 0
        ? t("ratingImpact", { pct: urgent.shopRatingImpactPct })
        : t("replyExpected")
      : "—",
    href: "/dashboard/supplier/returns",
    cta: t("ctaReply"),
    tone: "violet",
    ctaVariant: active ? "default" : "outline",
  }
}

export async function SupplierUrgentActions({ urgent, locale }: Props) {
  const t = await getTranslations("supplierDashboard.urgent")

  const ship = buildShipSlot(urgent, t, locale)
  const stock = buildStockSlot(urgent, t)
  const message = buildMessageSlot(urgent, t)

  const allClear = !ship.active && !stock.active && !message.active

  return (
    <section aria-labelledby="urgent-heading" className="space-y-4">
      <h2 id="urgent-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {t("title")}
      </h2>

      {allClear ? (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 px-5 py-6 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <p className="font-semibold text-emerald-950 dark:text-emerald-100">{t("allClearTitle")}</p>
              <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                {t("allClearNext")}{" "}
                <Link
                  href="/dashboard/supplier/products/new"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-200"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t("addProduct")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <SupplierUrgentCarousel>
          <UrgentSlot {...ship} />
          <UrgentSlot {...stock} />
          <UrgentSlot {...message} />
        </SupplierUrgentCarousel>
      )}
    </section>
  )
}
