"use client"

import Link from "next/link"
import {
  BadgeCheck,
  Check,
  ClipboardCheck,
  Loader2,
  Package,
  Truck,
  Workflow,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { AFFISELL_MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-order-settlement"
import { cn } from "@/lib/utils"

type OrderRow = {
  id: string
  fulfillmentSource: "marketplace" | "blind_dropship"
  status: string
  displayStatus: string
  canMarkPreparing: boolean
  canMarkShipped: boolean
  supplierPreparingAt: string | null
  quantity: number
  variantLabel: string | null
  customerEmail: string
  supplierNetCents: number
  affisellFeeCents: number
  affiliateCommissionCents: number
  partnerListingCode: string | null
  createdAt: string
  shippedAt: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  shippingAddressFormatted: string
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
}

type Tab = "to_ship" | "shipped" | "all"

function FulfillmentRail({
  status,
  supplierPreparingAt,
}: {
  status: OrderRow["status"]
  supplierPreparingAt: string | null
}) {
  const steps = useMemo(
    () =>
      (
        [
          {
            key: "paid" as const,
            label: "Captured · queued",
            detail: "Funds settled — ship window open",
          },
          {
            key: "preparing" as const,
            label: "Inbound · prepping",
            detail: "Buyer gets a live pulse when you confirm",
          },
          {
            key: "shipped" as const,
            label: "Outbound · tracked",
            detail: "Carrier + ID mirrored to buyer orders",
          },
        ] as const
      ).map((meta, idx) => ({
        ...meta,
        index: idx,
      })),
    []
  )

  const activeRank = status === "shipped" ? 2 : status === "preparing" ? 1 : 0

  return (
    <div
      className="relative mt-5 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/70 shadow-[0_24px_80px_-48px_rgba(109,40,217,0.45)] backdrop-blur-xl dark:border-zinc-700/90 dark:bg-zinc-950/75 dark:shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)]"
      role="region"
      aria-label="Fulfillment trail"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(ellipse 90% 80% at 0% -30%, rgb(139 92 246 / 0.22), transparent 55%),
            radial-gradient(ellipse 70% 60% at 100% 0%, rgb(6 182 212 / 0.12), transparent 50%),
            linear-gradient(180deg, rgb(250 245 255 / 0.9) 0%, transparent 45%)
          `,
        }}
      />
      <div className="relative border-b border-zinc-100/90 px-4 py-3 dark:border-zinc-800/80 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/25">
              <Workflow className="size-4 shrink-0 opacity-95" aria-hidden strokeWidth={2.25} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Fulfillment trail</p>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30">
                  Live
                </span>
              </div>
              <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Progressive handoff — each checkpoint syncs buyer notifications before tracking exists.
              </p>
            </div>
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
            Step {Math.min(activeRank + 1, 3)} / 3
          </p>
        </div>
      </div>

      {/* Desktop: horizontal runway */}
      <div className="relative hidden pb-6 pt-7 sm:block sm:px-6">
        <div className="flex items-start">
          {steps.flatMap(({ key, label, detail, index }) => {
            const complete =
              index < activeRank || (status === "shipped" && index <= 2)
            const active = index === activeRank && status !== "shipped"

            let Icon = Package
            if (key === "preparing") Icon = ClipboardCheck
            if (key === "shipped") Icon = Truck

            const segmentFilled = activeRank > index

            const column = (
              <div key={key} className="flex w-[min(28%,140px)] shrink-0 flex-col items-center">
                <div
                  className={cn(
                    "relative z-[1] flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 transition-all duration-300",
                    complete
                      ? "border-emerald-400/80 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_12px_28px_-12px_rgb(16_185_129_/_0.65)] dark:from-emerald-600 dark:to-teal-700"
                      : active
                        ? "border-violet-500 bg-white text-violet-700 shadow-[0_0_0_4px_rgb(139_92_246_/_0.2),0_16px_40px_-24px_rgb(109_40_217_/_0.55)] dark:bg-zinc-900 dark:text-violet-300 dark:shadow-[0_0_0_4px_rgb(139_92_246_/_0.25)]"
                        : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-500"
                  )}
                >
                  {complete ? (
                    <Check className="size-5" aria-hidden strokeWidth={3} />
                  ) : active ? (
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400 opacity-40" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-violet-600 dark:bg-violet-400" />
                    </span>
                  ) : (
                    <Icon className="size-[18px] opacity-80" aria-hidden strokeWidth={2} />
                  )}
                </div>

                <div className="mt-3 w-full text-center">
                  <p
                    className={cn(
                      "text-[13px] font-semibold leading-snug tracking-tight",
                      active ? "text-violet-950 dark:text-violet-100" : "text-zinc-900 dark:text-zinc-100"
                    )}
                  >
                    {label}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{detail}</p>
                  {key === "preparing" && supplierPreparingAt ? (
                    <p className="mt-2 inline-flex flex-wrap items-center justify-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
                      Pulse sent · {new Date(supplierPreparingAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </div>
            )

            if (index === steps.length - 1) return [column]

            const connector = (
              <div
                key={`${key}-connector`}
                className="relative mx-2 mt-[22px] h-[3px] min-w-[32px] flex-1 shrink rounded-full bg-zinc-200 dark:bg-zinc-700"
                aria-hidden
              >
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-500 transition-all duration-700 ease-out",
                    segmentFilled ? "w-full opacity-100" : "w-0 opacity-0"
                  )}
                />
              </div>
            )

            return [column, connector]
          })}
        </div>
      </div>

      {/* Mobile: vertical trail */}
      <ul className="relative space-y-0 px-4 pb-5 pt-6 sm:hidden">
        <div
          className="absolute bottom-8 left-[21px] top-10 w-px bg-gradient-to-b from-violet-300 via-violet-200 to-zinc-200 dark:from-violet-600 dark:via-violet-900 dark:to-zinc-700"
          aria-hidden
        />
        {steps.map(({ key, label, detail, index }) => {
          const complete =
            index < activeRank || (status === "shipped" && index <= 2)
          const active = index === activeRank && status !== "shipped"

          let Icon = Package
          if (key === "preparing") Icon = ClipboardCheck
          if (key === "shipped") Icon = Truck

          return (
            <li key={key} className="relative flex gap-4 pl-1">
              <div
                className={cn(
                  "relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-300",
                  complete
                    ? "border-emerald-400/80 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20"
                    : active
                      ? "border-violet-500 bg-white shadow-[0_0_0_3px_rgb(139_92_246_/_0.22)] dark:bg-zinc-900"
                      : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80"
                )}
              >
                {complete ? (
                  <Check className="size-[18px]" aria-hidden strokeWidth={3} />
                ) : active ? (
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400 opacity-35" />
                    <span className="relative inline-flex size-2 rounded-full bg-violet-600 dark:bg-violet-400" />
                  </span>
                ) : (
                  <Icon className="size-[16px] text-zinc-400 dark:text-zinc-500" aria-hidden strokeWidth={2} />
                )}
              </div>
              <div className="min-w-0 pb-6 pt-0.5">
                <p className={cn("text-sm font-semibold leading-tight", active ? "text-violet-950 dark:text-violet-50" : "text-zinc-900 dark:text-zinc-50")}>
                  {label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">{detail}</p>
                {key === "preparing" && supplierPreparingAt ? (
                  <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                    <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
                    Pulse sent · {new Date(supplierPreparingAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function SupplierOrdersPanel({ className }: { className?: string }) {
  const [tab, setTab] = useState<Tab>("to_ship")
  const [rows, setRows] = useState<OrderRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [trackingByOrder, setTrackingByOrder] = useState<Record<string, { carrier: string; number: string }>>({})

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/supplier/orders?tab=${tab}`, { cache: "no-store" })
    if (!res.ok) {
      setError("Could not load orders")
      setRows([])
      return
    }
    const j = (await res.json()) as { orders: OrderRow[] }
    setRows(j.orders)
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  async function patchOrder(orderId: string, body: Record<string, string | undefined>) {
    setBusy(orderId)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? "Update failed")
        return
      }
      await load()
      window.dispatchEvent(new CustomEvent("affisell:supplier-notifications-changed"))
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
    if (!trackingNumber) {
      setError("Enter a tracking number before marking as shipped.")
      return
    }
    await patchOrder(orderId, {
      action: "mark_shipped",
      trackingNumber,
      ...(t?.carrier?.trim() ? { trackingCarrier: t.carrier.trim() } : {}),
    })
  }

  function setTracking(orderId: string, field: "carrier" | "number", value: string) {
    setTrackingByOrder((prev) => ({
      ...prev,
      [orderId]: {
        carrier: field === "carrier" ? value : (prev[orderId]?.carrier ?? ""),
        number: field === "number" ? value : (prev[orderId]?.number ?? ""),
      },
    }))
  }

  function statusBadgeClass(status: OrderRow["status"]) {
    if (status === "shipped")
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
    if (status === "preparing") {
      return "bg-gradient-to-r from-sky-100 to-violet-100 text-sky-950 ring-1 ring-sky-200/70 dark:from-sky-950/50 dark:to-violet-950/50 dark:text-sky-100 dark:ring-sky-900/70"
    }
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
  }

  if (rows === null) {
    return <p className={cn("text-sm text-zinc-500", className)}>Loading…</p>
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "to_ship", label: "To ship" },
    { id: "shipped", label: "Shipped" },
    { id: "all", label: "All" },
  ]

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
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

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card className="border-zinc-200 p-10 text-center dark:border-zinc-700">
          <Package className="mx-auto mb-3 size-9 text-zinc-300 dark:text-zinc-600" aria-hidden />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {tab === "to_ship"
              ? "Nothing in the runway right now — new marketplace payouts land here instantly after Stripe settles."
              : "No orders in this view yet."}
          </p>
        </Card>
      ) : (
        rows.map((o) => (
          <Card key={o.id} className="relative overflow-hidden border-zinc-200/90 dark:border-zinc-700">
            <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-violet-400 to-fuchsia-400 opacity-80")} />

            <div className="p-4 pb-5 sm:p-5">
              <div className="flex flex-wrap gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/70 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                  {o.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.product.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">{o.product.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {o.fulfillmentSource === "blind_dropship" ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
                          Blind dropship
                        </span>
                      ) : null}
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm", statusBadgeClass(o.status))}>{o.displayStatus}</span>
                    </div>
                  </div>
                  {o.variantLabel ? <p className="text-xs text-zinc-500">Variant: {o.variantLabel}</p> : null}
                  {o.product.supplierSku ? <p className="text-xs text-zinc-500">SKU: {o.product.supplierSku}</p> : null}
                  <p className="mt-1 text-xs text-zinc-500">
                    ×{o.quantity} · {new Date(o.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-3 rounded-xl border border-zinc-100 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Settlement detail
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                      <li className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                        <span>Your wholesale (your article)</span>
                        <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                          {formatStoreCurrencyFromCents(o.supplierNetCents)}
                        </span>
                      </li>
                      <li className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                        <span>
                          − Affisell marketplace ({AFFISELL_MARKETPLACE_FEE_PERCENT}% of partner checkout)
                        </span>
                        <span className="tabular-nums">{formatStoreCurrencyFromCents(o.affisellFeeCents)}</span>
                      </li>
                      <li className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                        <span>− Partner listing commission (your offer)</span>
                        <span className="tabular-nums">{formatStoreCurrencyFromCents(o.affiliateCommissionCents)}</span>
                      </li>
                    </ul>
                    <p className="mt-2 border-t border-zinc-100 pt-2 text-xs font-semibold text-violet-800 dark:text-violet-300">
                      Your payout basis (wholesale): {formatStoreCurrencyFromCents(o.supplierNetCents)}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                      Partner storefront retail total is not shown. Marketplace and listing commissions are funded from
                      partner-channel revenue; they do not reduce your wholesale. Use the listing reference below only if
                      Affisell support asks for it.
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                    Buyer: <span className="font-medium">{o.customerEmail}</span>
                    {o.partnerListingCode ? (
                      <>
                        {" "}
                        · Partner listing{" "}
                        <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                          {o.partnerListingCode}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Merchant payout: <span className="font-medium">{o.payoutStatus}</span>
                    {o.payoutEligibleAt && !o.supplierPayoutAt ? ` · from ${new Date(o.payoutEligibleAt).toLocaleDateString()}` : null}
                    {o.supplierPayoutAt ? ` · paid ${new Date(o.supplierPayoutAt).toLocaleDateString()}` : null}
                  </p>
                  {o.openReturn ? (
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                      Open return ({o.openReturn.status}) — payouts on hold —{" "}
                      <Link href="/dashboard/supplier/returns" className="underline">
                        Returns inbox
                      </Link>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-zinc-100 bg-zinc-50/85 p-3.5 shadow-inner dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Ship to</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-snug text-zinc-800 dark:text-zinc-100">
                  {o.shippingAddressFormatted}
                </pre>
              </div>

              {o.fulfillmentSource === "marketplace" ? (
                <FulfillmentRail status={o.status} supplierPreparingAt={o.supplierPreparingAt} />
              ) : null}

              {o.status === "shipped" && o.trackingNumber ? (
                <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/85 px-3 py-2.5 text-sm text-emerald-950 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100">
                  <Truck className="size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="font-semibold">{o.trackingCarrier ?? "Carrier"}</span> {o.trackingNumber}
                  </span>
                  {o.shippedAt ? (
                    <span className="text-xs text-emerald-800/80 dark:text-emerald-200/80">· Departed {new Date(o.shippedAt).toLocaleString()}</span>
                  ) : null}
                </div>
              ) : null}

              {o.canMarkPreparing ? (
                <div className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Customer pulse check</p>
                    <p className="max-w-xl text-xs text-zinc-600 dark:text-zinc-400">
                      Tap once you acknowledge the order in your ERP/WMS — we instantly mirror that confidence to the shopper.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-violet-200 bg-white/90 shadow-sm hover:bg-violet-50 dark:border-violet-900 dark:bg-zinc-950 dark:hover:bg-violet-950/40"
                    disabled={busy === o.id}
                    onClick={() => void markPreparing(o.id)}
                  >
                    {busy === o.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ClipboardCheck className="size-4" aria-hidden />}
                    Received · now preparing
                  </Button>
                </div>
              ) : null}

              {o.canMarkShipped ? (
                <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                  <div className="min-w-[160px] flex-1 space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500" htmlFor={`carrier-${o.id}`}>
                      Carrier
                    </label>
                    <input
                      id={`carrier-${o.id}`}
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-violet-400 dark:border-zinc-600 dark:bg-zinc-950"
                      placeholder="UPS, Chronopost, DHL…"
                      value={trackingByOrder[o.id]?.carrier ?? ""}
                      onChange={(e) => setTracking(o.id, "carrier", e.target.value)}
                    />
                  </div>
                  <div className="min-w-[200px] flex-[1.3] space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500" htmlFor={`tracking-${o.id}`}>
                      Tracking number *
                    </label>
                    <input
                      id={`tracking-${o.id}`}
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-violet-400 dark:border-zinc-600 dark:bg-zinc-950"
                      placeholder="Paste the carrier reference"
                      value={trackingByOrder[o.id]?.number ?? ""}
                      onChange={(e) => setTracking(o.id, "number", e.target.value)}
                    />
                  </div>
                  <Button type="button" disabled={busy === o.id} onClick={() => void markShipped(o.id)} className="h-11 gap-2 px-6">
                    {busy === o.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Truck className="size-4" aria-hidden />}
                    Mark shipped
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
