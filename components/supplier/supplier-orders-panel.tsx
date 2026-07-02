"use client"

import Link from "next/link"
import {
  Check,
  ClipboardCheck,
  Coins,
  Loader2,
  MapPin,
  Package,
  Truck,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { ShipPulseBadge } from "@/components/supplier/ship-pulse-badge"
import { SupplierOrderFulfillmentPanel } from "@/components/supplier/supplier-order-fulfillment-panel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  isShipDeadlineBreached,
  isShipDeadlineCritical,
} from "@/lib/supplier-ship-sla-shared"
import {
  defaultSupplierOrdersSort,
  sortSupplierOrderRows,
  type SupplierOrdersSort,
} from "@/lib/supplier-orders-sort"
import {
  defaultTrustedCarrierLabel,
  trustedCarriersForCountry,
} from "@/lib/trusted-carriers-shared"
import { validateShipTrackingFormat } from "@/lib/ship-tracking-validate.shared"
import { cn } from "@/lib/utils"

type TrackingValidationState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; verifiedBy?: string }
  | { status: "invalid"; message: string }

type OrderRow = {
  id: string
  fulfillmentSource: "marketplace" | "blind_dropship"
  status: string
  displayStatus: string
  fulfillmentStatus: string
  payoutStatusDb: string
  canMarkPreparing: boolean
  canMarkShipped: boolean
  supplierPreparingAt: string | null
  quantity: number
  variantLabel: string | null
  customerEmail: string
  supplierNetCents: number
  supplierPlatformFeeCents: number
  affiliateCommissionCents: number
  partnerListingCode: string | null
  createdAt: string
  shippedAt: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  shippingAddressFormatted: string
  shippingCountryIso2: string
  product: {
    id: string
    name: string
    imageUrl: string | null
    supplierSku: string | null
  }
  openReturn: { id: string; status: string } | null
  payoutStatus: string
  payoutEligibleAt: string | null
  supplierPayoutAt: string | null
  shipPulse: {
    deadlineAt: string
    msRemaining: number
    phase: "safe" | "urgent" | "critical" | "breached"
    extensionPending?: boolean
  } | null
}

type Tab = "to_ship" | "shipped" | "all"

function formatOrderWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function splitShipTo(formatted: string) {
  const lines = formatted
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { name: "—", rest: "" }
  return { name: lines[0], rest: lines.slice(1).join(" · ") }
}

function FulfillmentRail({
  status,
  supplierPreparingAt,
}: {
  status: OrderRow["status"]
  supplierPreparingAt: string | null
}) {
  const t = useTranslations("supplierOrders.fulfillmentRail")
  const steps = [
    { key: "paid" as const, label: t("paid"), Icon: Package },
    { key: "preparing" as const, label: t("preparing"), Icon: ClipboardCheck },
    { key: "shipped" as const, label: t("shipped"), Icon: Truck },
  ]

  const activeRank = status === "shipped" ? 2 : status === "preparing" ? 1 : 0

  return (
    <div
      className="mt-4 flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"
      role="region"
      aria-label={t("ariaLabel")}
    >
      {steps.map(({ key, label, Icon }, index) => {
        const complete = index < activeRank || (status === "shipped" && index <= 2)
        const active = index === activeRank && status !== "shipped"

        return (
          <div key={key} className="flex min-w-0 flex-1 items-center gap-1">
            {index > 0 ? (
              <div
                className={cn(
                  "h-0.5 min-w-[12px] flex-1 rounded-full transition-colors duration-500",
                  index <= activeRank ? "bg-violet-500" : "bg-zinc-200 dark:bg-zinc-700"
                )}
                aria-hidden
              />
            ) : null}
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1",
                index > 0 ? "pl-0" : ""
              )}
            >
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border transition-all",
                  complete
                    ? "border-emerald-500/50 bg-emerald-500 text-white"
                    : active
                      ? "border-violet-500 bg-white text-violet-700 shadow-[0_0_0_3px_rgb(139_92_246_/_0.18)] dark:bg-zinc-950 dark:text-violet-300"
                      : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                )}
              >
                {complete ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  <Icon className="size-3.5" aria-hidden strokeWidth={2.25} />
                )}
              </div>
              <span
                className={cn(
                  "truncate text-[10px] font-semibold uppercase tracking-wide",
                  active ? "text-violet-700 dark:text-violet-300" : "text-zinc-500 dark:text-zinc-400"
                )}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
      {supplierPreparingAt ? (
        <span className="sr-only">
          {t("preparingConfirmed", {
            date: new Date(supplierPreparingAt).toLocaleString(),
          })}
        </span>
      ) : null}
    </div>
  )
}

function PayoutStrip({ o }: { o: OrderRow }) {
  const t = useTranslations("supplierOrders.payout")
  const feesTotal = o.supplierPlatformFeeCents + o.affiliateCommissionCents
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 px-4 py-3 text-white shadow-lg shadow-violet-600/20">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Coins className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100">{t("yourPayout")}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {formatStoreCurrencyFromCents(o.supplierNetCents)}
          </p>
          <p className="text-[11px] text-violet-100/90">{t("netWholesaleHint")}</p>
        </div>
      </div>
      {feesTotal > 0 ? (
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {o.affiliateCommissionCents > 0 ? (
            <span
              className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium tabular-nums text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              title={t("partnerCommissionTitle")}
            >
              {t("partnerCommission", {
                amount: formatStoreCurrencyFromCents(o.affiliateCommissionCents),
              })}
            </span>
          ) : null}
          {o.supplierPlatformFeeCents > 0 ? (
            <span
              className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              title={t("platformFeeTitle")}
            >
              {t("platformFee", { amount: formatStoreCurrencyFromCents(o.supplierPlatformFeeCents) })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function OrderMetaChips({ o }: { o: OrderRow }) {
  const t = useTranslations("supplierOrders.payout")
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span
        className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
        title={o.id}
      >
        #{o.id.slice(-8).toUpperCase()}
      </span>
      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {o.customerEmail}
      </span>
      {o.partnerListingCode ? (
        <span
          className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          title={t("partnerStoreTitle", { code: o.partnerListingCode })}
        >
          {o.partnerListingCode}
        </span>
      ) : null}
      <span
        className={cn(
          "rounded-md px-2 py-0.5 text-[11px] font-medium",
          o.supplierPayoutAt
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        )}
      >
        {o.supplierPayoutAt
          ? `Paid ${new Date(o.supplierPayoutAt).toLocaleDateString()}`
          : o.payoutStatus}
      </span>
    </div>
  )
}

export function SupplierOrdersPanel({ className }: { className?: string }) {
  const msg = useTranslations("supplierOrders")
  const [tab, setTab] = useState<Tab>("to_ship")
  const [sortBy, setSortBy] = useState<SupplierOrdersSort>(() => defaultSupplierOrdersSort("to_ship"))
  const [rows, setRows] = useState<OrderRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [trackingByOrder, setTrackingByOrder] = useState<Record<string, { carrier: string; number: string }>>({})
  const [trackingValidation, setTrackingValidation] = useState<Record<string, TrackingValidationState>>({})
  const trackingValidateTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const scheduleTrackingValidation = useCallback(
    (orderId: string, carrier: string, number: string, countryIso2: string) => {
      if (trackingValidateTimers.current[orderId]) {
        clearTimeout(trackingValidateTimers.current[orderId])
      }

      const trimmed = number.trim()
      if (!carrier.trim() || !trimmed) {
        setTrackingValidation((prev) => ({ ...prev, [orderId]: { status: "idle" } }))
        return
      }

      const local = validateShipTrackingFormat({ trackingCarrier: carrier, trackingNumber: trimmed })
      if (!local.ok) {
        setTrackingValidation((prev) => ({
          ...prev,
          [orderId]: { status: "invalid", message: local.message },
        }))
        return
      }

      setTrackingValidation((prev) => ({ ...prev, [orderId]: { status: "checking" } }))
      trackingValidateTimers.current[orderId] = setTimeout(() => {
        void (async () => {
          try {
            const res = await fetch("/api/supplier/orders/validate-tracking", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                trackingCarrier: carrier.trim(),
                trackingNumber: trimmed,
                countryIso2: countryIso2,
              }),
            })
            const json = (await res.json()) as {
              valid?: boolean
              message?: string
              verifiedBy?: string
            }
            if (json.valid) {
              setTrackingValidation((prev) => ({
                ...prev,
                [orderId]: { status: "valid", verifiedBy: json.verifiedBy },
              }))
            } else {
              setTrackingValidation((prev) => ({
                ...prev,
                [orderId]: {
                  status: "invalid",
                  message: json.message ?? msg("trackingInvalid"),
                },
              }))
            }
          } catch {
            setTrackingValidation((prev) => ({
              ...prev,
              [orderId]: { status: "valid", verifiedBy: "format" },
            }))
          }
        })()
      }, 480)
    },
    [msg]
  )

  useEffect(() => {
    return () => {
      for (const timer of Object.values(trackingValidateTimers.current)) {
        clearTimeout(timer)
      }
    }
  }, [])

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/supplier/orders?tab=${tab}`, { cache: "no-store" })
    if (!res.ok) {
      setError(msg("loadError"))
      setRows([])
      return
    }
    const j = (await res.json()) as { orders: OrderRow[] }
    setRows(j.orders)
    window.dispatchEvent(new CustomEvent("affisell:supplier-notifications-changed"))
  }, [tab, msg])

  useEffect(() => {
    void load()
  }, [load])

  function handleTabChange(next: Tab) {
    setTab(next)
    setSortBy((prev) => (next !== "to_ship" && prev === "urgency" ? "date_desc" : prev))
  }

  useEffect(() => {
    if (!rows) return
    setTrackingByOrder((prev) => {
      const next = { ...prev }
      for (const o of rows) {
        if (!o.canMarkShipped) continue
        const existing = next[o.id]
        const defaultCarrier = defaultTrustedCarrierLabel(o.shippingCountryIso2)
        next[o.id] = {
          carrier: existing?.carrier || defaultCarrier,
          number: existing?.number ?? "",
        }
      }
      return next
    })
  }, [rows])

  async function patchOrder(
    orderId: string,
    body: Record<string, string | undefined>
  ): Promise<{ payoutTriggered?: boolean } | null> {
    setBusy(orderId)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        payoutTriggered?: boolean
      }
      if (!res.ok) {
        setError(j.error ?? msg("updateFailed"))
        return null
      }
      await load()
      window.dispatchEvent(new CustomEvent("affisell:supplier-notifications-changed"))
      return j
    } finally {
      setBusy(null)
    }
  }

  async function markPreparing(orderId: string) {
    await patchOrder(orderId, { action: "mark_preparing" })
  }

  async function markShipped(orderId: string) {
    const t = trackingByOrder[orderId]
    const trackingNumber = t?.number?.trim() ?? ""
    const carrier = t?.carrier?.trim() ?? ""
    if (!carrier) {
      setError(msg("carrierRequired"))
      return
    }
    if (!trackingNumber) {
      setError(msg("trackingRequired"))
      return
    }
    const validation = trackingValidation[orderId]
    if (validation?.status === "invalid") {
      setError(validation.message)
      return
    }
    if (validation?.status === "checking") {
      setError(msg("trackingValidating"))
      return
    }
    const local = validateShipTrackingFormat({ trackingCarrier: carrier, trackingNumber })
    if (!local.ok) {
      setError(local.message)
      return
    }
    const result = await patchOrder(orderId, {
      action: "mark_shipped",
      trackingNumber,
      trackingCarrier: carrier,
    })
    if (result) {
      toast.success(
        result.payoutTriggered
          ? "Expédié. Lightning Payout déclenché"
          : "Expédié. Payout à J+2"
      )
    }
  }

  function setTracking(
    orderId: string,
    field: "carrier" | "number",
    value: string,
    countryIso2?: string
  ) {
    setTrackingByOrder((prev) => {
      const next = {
        carrier: field === "carrier" ? value : (prev[orderId]?.carrier ?? ""),
        number: field === "number" ? value : (prev[orderId]?.number ?? ""),
      }
      if (countryIso2) {
        scheduleTrackingValidation(orderId, next.carrier, next.number, countryIso2)
      }
      return { ...prev, [orderId]: next }
    })
  }

  function orderStatusLabel(status: OrderRow["status"]) {
    if (status === "shipped") return msg("status.shipped")
    if (status === "preparing") return msg("status.preparing")
    return msg("status.paid")
  }

  function statusBadgeClass(status: OrderRow["status"]) {
    if (status === "shipped") {
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
    }
    if (status === "preparing") {
      return "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
    }
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
  }

  const displayRows = useMemo(() => {
    if (!rows) return null
    return sortSupplierOrderRows(rows, { tab, sort: sortBy })
  }, [rows, tab, sortBy])

  if (rows === null) {
    return <p className={cn("text-sm text-zinc-500", className)}>{msg("loading")}</p>
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "to_ship", label: msg("tabs.toShip") },
    { id: "shipped", label: msg("tabs.shipped") },
    { id: "all", label: msg("tabs.all") },
  ]

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                tab === t.id
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{msg("sort.label")}</span>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SupplierOrdersSort)}>
            <SelectTrigger className="h-9 w-[min(100%,220px)] rounded-full border-zinc-200 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tab === "to_ship" ? (
                <SelectItem value="urgency">{msg("sort.urgency")}</SelectItem>
              ) : null}
              <SelectItem value="date_desc">{msg("sort.dateDesc")}</SelectItem>
              <SelectItem value="date_asc">{msg("sort.dateAsc")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {(displayRows ?? []).length === 0 ? (
        <Card className="border-zinc-200 p-10 text-center dark:border-zinc-700">
          <Package className="mx-auto mb-3 size-9 text-zinc-300 dark:text-zinc-600" aria-hidden />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {tab === "to_ship" ? msg("emptyToShip") : msg("emptyTab")}
          </p>
        </Card>
      ) : (
        (displayRows ?? []).map((o) => {
          const shipTo = splitShipTo(o.shippingAddressFormatted)
          const shipLate = isShipDeadlineBreached(o.shipPulse)
          const shipCritical = isShipDeadlineCritical(o.shipPulse)
          return (
            <Card
              key={o.id}
              className={cn(
                "overflow-hidden border bg-white shadow-sm dark:bg-zinc-950",
                shipLate
                  ? "border-zinc-200 border-l-4 border-l-red-600 dark:border-zinc-700 dark:border-l-red-500"
                  : shipCritical
                    ? "border-zinc-200 border-l-4 border-l-amber-500 dark:border-zinc-700 dark:border-l-amber-500"
                    : "border-zinc-200/90 dark:border-zinc-700"
              )}
            >
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
                <div className="border-b border-zinc-100 p-4 dark:border-zinc-800 sm:p-5 lg:border-b-0 lg:border-r">
                  <div className="flex gap-3 sm:gap-4">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 sm:h-16 sm:w-16">
                      {o.product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.product.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="m-auto size-6 text-zinc-300 dark:text-zinc-600" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2
                          className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50 sm:text-[15px]"
                          title={o.product.name}
                        >
                          {o.product.name}
                        </h2>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          {o.fulfillmentSource === "blind_dropship" ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
                              Blind
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              statusBadgeClass(o.status)
                            )}
                          >
                            {orderStatusLabel(o.status)}
                          </span>
                        </div>
                      </div>
                      {o.shipPulse ? (
                        <div className="mt-2">
                          <ShipPulseBadge
                            deadlineAt={o.shipPulse.deadlineAt}
                            msRemaining={o.shipPulse.msRemaining}
                            phase={o.shipPulse.phase}
                            extensionPending={o.shipPulse.extensionPending}
                          />
                        </div>
                      ) : null}
                      <p className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                        <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">×{o.quantity}</span>
                        <span aria-hidden>·</span>
                        <span>{formatOrderWhen(o.createdAt)}</span>
                        {o.variantLabel ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{o.variantLabel}</span>
                          </>
                        ) : null}
                        {o.product.supplierSku ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="font-mono">{o.product.supplierSku}</span>
                          </>
                        ) : null}
                      </p>

                      <PayoutStrip o={o} />
                      <OrderMetaChips o={o} />

                      {o.fulfillmentSource === "marketplace" ? (
                        <FulfillmentRail status={o.status} supplierPreparingAt={o.supplierPreparingAt} />
                      ) : null}

                      {o.fulfillmentSource === "marketplace" &&
                      (o.status === "paid" || o.status === "preparing") ? (
                        <SupplierOrderFulfillmentPanel
                          orderId={o.id}
                          className="mt-3"
                          onUpdated={() => void load()}
                        />
                      ) : null}

                      {o.fulfillmentSource === "marketplace" ? (
                        <Link
                          href={`/dashboard/orders/${o.id}`}
                          className="mt-3 inline-block text-xs font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
                        >
                          {msg("actions.splitDetail")}
                        </Link>
                      ) : null}

                      {o.openReturn ? (
                        <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
                          Return open ({o.openReturn.status}) —{" "}
                          <Link href="/dashboard/supplier/returns" className="font-semibold underline">
                            Inbox
                          </Link>
                        </p>
                      ) : null}

                      {o.status === "shipped" && o.trackingNumber ? (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                          <Truck className="size-4 shrink-0" aria-hidden />
                          <span className="min-w-0 truncate font-medium">
                            {o.trackingCarrier ?? "Carrier"} · {o.trackingNumber}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col bg-zinc-50/70 p-4 dark:bg-zinc-900/30 sm:p-5">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    <MapPin className="size-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
                    {msg("actions.shipTo")}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{shipTo.name}</p>
                  {shipTo.rest ? (
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{shipTo.rest}</p>
                  ) : null}

                  {o.canMarkPreparing ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full gap-2 border-violet-200 dark:border-violet-900"
                      disabled={busy === o.id}
                      onClick={() => void markPreparing(o.id)}
                    >
                      {busy === o.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <ClipboardCheck className="size-4" aria-hidden />
                      )}
                      {msg("actions.markPreparing")}
                    </Button>
                  ) : null}

                  {o.canMarkShipped ? (
                    <div className="mt-auto space-y-2 pt-4">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {msg("actions.carrierCountryHint", { country: o.shippingCountryIso2 })}
                      </p>
                      <Select
                        value={trackingByOrder[o.id]?.carrier ?? defaultTrustedCarrierLabel(o.shippingCountryIso2)}
                        onValueChange={(value) => {
                          if (value) setTracking(o.id, "carrier", value, o.shippingCountryIso2)
                        }}
                        disabled={busy === o.id}
                      >
                        <SelectTrigger
                          id={`carrier-${o.id}`}
                          className="h-9 w-full border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-950"
                          aria-label={msg("actions.carrier")}
                        >
                          <SelectValue placeholder={msg("actions.carrier")} />
                        </SelectTrigger>
                        <SelectContent>
                          {trustedCarriersForCountry(o.shippingCountryIso2).map((row) => (
                            <SelectItem key={row.label} value={row.label}>
                              {row.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <input
                          id={`tracking-${o.id}`}
                          className={cn(
                            "h-9 w-full rounded-lg border bg-white px-3 pr-9 text-sm outline-none focus:border-violet-400 dark:bg-zinc-950",
                            trackingValidation[o.id]?.status === "invalid"
                              ? "border-red-300 dark:border-red-800"
                              : trackingValidation[o.id]?.status === "valid"
                                ? "border-emerald-300 dark:border-emerald-800"
                                : "border-zinc-200 dark:border-zinc-600"
                          )}
                          placeholder={msg("actions.trackingNumber")}
                          aria-label={msg("actions.trackingNumber")}
                          aria-invalid={trackingValidation[o.id]?.status === "invalid"}
                          value={trackingByOrder[o.id]?.number ?? ""}
                          onChange={(e) =>
                            setTracking(o.id, "number", e.target.value, o.shippingCountryIso2)
                          }
                          onBlur={() => {
                            const t = trackingByOrder[o.id]
                            scheduleTrackingValidation(
                              o.id,
                              t?.carrier ?? defaultTrustedCarrierLabel(o.shippingCountryIso2),
                              t?.number ?? "",
                              o.shippingCountryIso2
                            )
                          }}
                        />
                        {trackingValidation[o.id]?.status === "checking" ? (
                          <Loader2
                            className="pointer-events-none absolute right-2.5 top-2 size-4 animate-spin text-violet-500"
                            aria-hidden
                          />
                        ) : trackingValidation[o.id]?.status === "valid" ? (
                          <Check
                            className="pointer-events-none absolute right-2.5 top-2 size-4 text-emerald-600"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      {(() => {
                        const v = trackingValidation[o.id]
                        if (v?.status === "invalid") {
                          return (
                            <p
                              className="text-[11px] leading-snug text-red-600 dark:text-red-400"
                              role="alert"
                            >
                              {v.message}
                            </p>
                          )
                        }
                        if (v?.status === "valid") {
                          return (
                            <p className="text-[11px] leading-snug text-emerald-700 dark:text-emerald-300">
                              {msg("trackingVerified")}
                            </p>
                          )
                        }
                        return (
                          <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                            {msg("trackingHint")}
                          </p>
                        )
                      })()}
                      <Button
                        type="button"
                        size="sm"
                        className="w-full gap-2"
                        disabled={
                          busy === o.id ||
                          trackingValidation[o.id]?.status === "checking" ||
                          trackingValidation[o.id]?.status === "invalid"
                        }
                        onClick={() => void markShipped(o.id)}
                      >
                        {busy === o.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Truck className="size-4" aria-hidden />
                        )}
                        {msg("actions.markShipped")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
