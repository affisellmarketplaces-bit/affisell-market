"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import type { BuyerOrderDetailDto } from "@/lib/buyer-order-detail-load"
import type { AppLocale } from "@/lib/i18n-locale"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  getReturnReasonLabel,
  RETURN_REASON_CODES,
  type ReturnReasonCode,
} from "@/lib/order-return-types"
import { cn } from "@/lib/utils"

type Props = {
  order: BuyerOrderDetailDto
  backHref: string
}

function orderStatusKey(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    preparing: "preparing",
    shipped: "shipped",
    refunded: "refunded",
    cancelled: "cancelled",
    CANCELLED: "cancelled",
  }
  return map[status] ?? "unknown"
}

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function BuyerOrderDetailView({ order, backHref }: Props) {
  const locale = useLocale()
  const t = useTranslations("buyerOrderDetail")
  const tReturn = useTranslations("accountOrders.return")
  const [returnOpen, setReturnOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>(
    RETURN_REASON_CODES[0] ?? "OTHER"
  )
  const [reasonDetail, setReasonDetail] = useState("")
  const [localOrder, setLocalOrder] = useState(order)

  const reasonOptions = useMemo(
    () =>
      RETURN_REASON_CODES.map((code) => ({
        code,
        label: getReturnReasonLabel(code, locale as AppLocale),
      })),
    [locale]
  )

  const statusLabel = t(`status.${orderStatusKey(localOrder.status)}`)
  const etaLabel = formatDate(localOrder.estimatedDeliveryAt, locale)
  const deliveredLabel = formatDate(localOrder.deliveredAt, locale)
  const withdrawalEndLabel = formatDate(localOrder.withdrawalEndsAt, locale)

  const showRefundInitiated =
    localOrder.activeReturn &&
    ["AWAITING_SHIPMENT", "IN_TRANSIT", "RECEIVED", "REFUNDED"].includes(
      localOrder.activeReturn.status
    )

  async function refreshOrder() {
    const res = await fetch(`/api/account/orders/${localOrder.id}/detail`, { cache: "no-store" })
    if (!res.ok) return
    const data = (await res.json()) as BuyerOrderDetailDto
    setLocalOrder(data)
  }

  async function submitReturn() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/account/orders/${localOrder.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasonCode,
          reasonDetail: reasonDetail.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? t("returnModal.error"))
        return
      }
      setReturnOpen(false)
      await refreshOrder()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>

      <BentoCard className="overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[minmax(0,220px)_1fr]">
          <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900 md:aspect-auto md:min-h-[220px]">
            {localOrder.product.imageUrl ? (
              <Image
                src={localOrder.product.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 220px"
              />
            ) : (
              <div className="flex h-full min-h-[180px] items-center justify-center text-zinc-400">
                <Package className="size-12" aria-hidden />
              </div>
            )}
          </div>

          <div className="space-y-4 p-5 md:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                {t("orderRef", { id: localOrder.id.slice(0, 8) })}
              </p>
              <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white sm:text-2xl">
                {localOrder.product.name}
              </h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-800 dark:text-emerald-200">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                {t("verifiedPartner")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950/60 dark:text-violet-100">
                {statusLabel}
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-white">
                {formatStoreCurrencyFromCents(localOrder.totalPaidCents)}{" "}
                <span className="text-sm font-medium text-zinc-500">{t("priceTtc")}</span>
              </span>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {localOrder.trackingNumber ? (
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                  <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <Truck className="size-3.5" aria-hidden />
                    {t("tracking")}
                  </dt>
                  <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                    {localOrder.trackingCarrier ?? t("carrierDefault")} · {localOrder.trackingNumber}
                  </dd>
                  {localOrder.trackingUrl ? (
                    <dd className="mt-2">
                      <a
                        href={localOrder.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
                      >
                        {t("trackPackage")}
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    </dd>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {deliveredLabel ? t("deliveredOn") : t("estimatedDelivery")}
                </dt>
                <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {deliveredLabel ?? etaLabel ?? t("etaPending")}
                </dd>
                {withdrawalEndLabel && localOrder.returnEligible ? (
                  <dd className="mt-1 text-xs text-zinc-500">
                    {t("withdrawalUntil", { date: withdrawalEndLabel })}
                  </dd>
                ) : null}
              </div>
            </dl>

            {localOrder.trackingTimeline.length > 0 ? (
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("trackingTimeline.title")}
                </p>
                <ol className="mt-3 space-y-3">
                  {localOrder.trackingTimeline.map((event) => (
                    <li key={event.id} className="flex gap-3 text-sm">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          event.eventType === "DELIVERED"
                            ? "bg-emerald-500"
                            : event.eventType === "IN_TRANSIT"
                              ? "bg-amber-500"
                              : "bg-violet-500"
                        )}
                        aria-hidden
                      />
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {t(`trackingTimeline.events.${event.eventType}` as "trackingTimeline.events.TRACKING_REGISTERED")}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(event.createdAt, locale)}
                          {event.trackingNumber
                            ? ` · ${event.trackingCarrier ?? t("carrierDefault")} ${event.trackingNumber}`
                            : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </BentoCard>

      {showRefundInitiated ? (
        <BentoCard className="border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            {localOrder.activeReturn?.status === "REFUNDED" ||
            localOrder.activeReturn?.status === "RECEIVED"
              ? t("refundInitiated")
              : t("returnApproved")}
          </p>
          {localOrder.returnAddress ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-emerald-200/60 bg-white/60 p-3 text-xs text-zinc-700 dark:border-emerald-900/40 dark:bg-zinc-950/40 dark:text-zinc-300">
              {localOrder.returnAddress}
            </pre>
          ) : null}
        </BentoCard>
      ) : null}

      {localOrder.activeReturn ? (
        <BentoCard className="space-y-3">
          <p className="text-sm">
            <span className="text-zinc-500">{tReturn("label")}</span>
            <span className="font-medium">
              {tReturn(`status.${localOrder.activeReturn.status}` as "status.REQUESTED")}
            </span>
          </p>
          {localOrder.activeReturn.status === "AWAITING_SHIPMENT" ? (
            <ReturnTrackingForm
              returnId={localOrder.activeReturn.id}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onDone={refreshOrder}
            />
          ) : null}
          {localOrder.activeReturn.status === "REQUESTED" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setError(null)
                setBusy(true)
                try {
                  const res = await fetch(
                    `/api/account/order-returns/${localOrder.activeReturn!.id}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "cancel" }),
                    }
                  )
                  if (!res.ok) {
                    const j = (await res.json().catch(() => ({}))) as { error?: string }
                    setError(j.error ?? tReturn("cancelError"))
                    return
                  }
                  await refreshOrder()
                } finally {
                  setBusy(false)
                }
              }}
            >
              {tReturn("cancelRequest")}
            </Button>
          ) : null}
        </BentoCard>
      ) : localOrder.returnEligible ? (
        <BentoCard className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-zinc-900 dark:text-white">{t("withdrawalTitle")}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("withdrawalBody")}</p>
          </div>
          <Button type="button" variant="bentoOutline" onClick={() => setReturnOpen(true)}>
            <RotateCcw className="size-4" aria-hidden />
            {t("returnCta")}
          </Button>
        </BentoCard>
      ) : localOrder.withdrawalEndsAt ? (
        <p className="text-sm text-zinc-500">
          {t("withdrawalEnded", { date: withdrawalEndLabel ?? "" })}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href={`/api/orders/${localOrder.id}/invoice?type=CUSTOMER`}
          className="rounded-full border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {t("invoice", { amount: formatStoreCurrencyFromCents(localOrder.totalPaidCents) })}
        </a>
        <Link
          href="/protected-checkout"
          className="rounded-full px-4 py-2 font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          {t("buyerProtection")}
        </Link>
        <Link
          href="/marketplace/account/gdpr"
          className="rounded-full px-4 py-2 font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          {t("gdpr")}
        </Link>
      </div>

      <Sheet open={returnOpen} onOpenChange={setReturnOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{t("returnModal.title")}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("returnModal.subtitle")}</p>

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("returnModal.reasonLabel")}
              <select
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
              >
                {reasonOptions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("returnModal.detailsLabel")}
              <textarea
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                rows={3}
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder={t("returnModal.detailsPlaceholder")}
              />
            </label>

            {localOrder.returnAddress ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("returnModal.addressLabel")}
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                  {localOrder.returnAddress}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">{t("returnModal.addressPending")}</p>
            )}

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setReturnOpen(false)}>
                {t("returnModal.cancel")}
              </Button>
              <Button
                type="button"
                variant="bentoSolid"
                className="flex-1"
                disabled={busy}
                onClick={() => void submitReturn()}
              >
                {busy ? t("returnModal.submitting") : t("returnModal.submit")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ReturnTrackingForm({
  returnId,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  returnId: string
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const t = useTranslations("accountOrders.return.trackingForm")
  const [carrier, setCarrier] = useState("")
  const [number, setNumber] = useState("")

  return (
    <div className={cn("space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-600")}>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("hint")}</p>
      <input
        className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        placeholder={t("carrierPlaceholder")}
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
      />
      <input
        className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        placeholder={t("numberPlaceholder")}
        value={number}
        onChange={(e) => setNumber(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={busy || !carrier.trim() || !number.trim()}
        onClick={async () => {
          setError(null)
          setBusy(true)
          try {
            const res = await fetch(`/api/account/order-returns/${returnId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "submit_tracking",
                buyerTrackingCarrier: carrier.trim(),
                buyerTrackingNumber: number.trim(),
              }),
            })
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string }
              setError(j.error ?? t("error"))
              return
            }
            await onDone()
          } finally {
            setBusy(false)
          }
        }}
      >
        {t("submit")}
      </Button>
    </div>
  )
}
