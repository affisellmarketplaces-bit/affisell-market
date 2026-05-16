"use client"

import Link from "next/link"
import {
  BadgeCheck,
  Check,
  ClipboardCheck,
  Loader2,
  Package,
  Radio,
  Sparkles,
  Truck,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
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
            label: "Paid & queued",
            detail: "Settlement captured securely",
          },
          {
            key: "preparing" as const,
            label: "Receiving & prepping",
            detail: "Notify your buyer you're on it",
          },
          {
            key: "shipped" as const,
            label: "Shipped · tracking shared",
            detail: "Customer sees carrier + number",
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
    <div className="relative mt-5 overflow-hidden rounded-2xl border border-violet-200/70 bg-[radial-gradient(120%_90%_at_10%_-20%,rgba(167,139,250,0.35),transparent_52%),linear-gradient(to_bottom_right,rgba(250,245,255,0.95),rgba(255,255,255,0.7))] p-4 shadow-[0_22px_60px_-32px_rgba(109,40,217,0.65)] backdrop-blur-sm dark:border-violet-900/55 dark:bg-[radial-gradient(120%_90%_at_10%_-20%,rgba(109,40,217,0.28),transparent_52%),linear-gradient(to_bottom_right,rgba(46,16,101,0.35),rgba(24,24,27,0.85))]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-950/85 dark:text-violet-100/90">
        <Sparkles className="size-3.5 text-violet-600 dark:text-violet-300" aria-hidden />
        Fulfillment runway
      </div>
      <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-violet-900/70 dark:text-violet-200/75">
        Reassure buyers early: confirming prep sends them an alert and updates “My orders” before tracking exists.
      </p>

      <ul className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-4 sm:[&>*]:flex-1 sm:[&>*]:pb-0">
        {steps.map(({ key, label, detail, index }) => {
          const done = index < activeRank || (status === "shipped" && index <= 2)
          const active = index === activeRank && status !== "shipped"
          const completeShipped = key === "shipped" && status === "shipped"

          let Icon = Package
          if (key === "preparing") Icon = ClipboardCheck
          if (key === "shipped") Icon = Truck

          return (
            <li key={key} className="relative flex gap-3 sm:flex-col sm:border-l sm:border-violet-200/40 sm:pl-4 sm:first:border-l-0 sm:first:pl-0 dark:sm:border-violet-900/55">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl border text-violet-800 shadow-inner dark:text-violet-100",
                  done || completeShipped
                    ? "border-emerald-300/70 bg-emerald-50/90 text-emerald-800 shadow-[0_0_0_1px_rgba(16,185,129,0.15)] dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : active
                      ? "border-violet-400/80 bg-white/95 ring-2 ring-violet-400/55 ring-offset-2 ring-offset-violet-50 dark:bg-zinc-950/85 dark:ring-violet-500/40 dark:ring-offset-zinc-950 animate-[pulse_2s_ease-in-out_infinite]"
                      : "border-zinc-200/70 bg-white/60 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/55"
                )}
              >
                {done || completeShipped ? (
                  <Check className="size-5 shrink-0" aria-hidden strokeWidth={2.75} />
                ) : active ? (
                  <Radio className="size-[18px] shrink-0" aria-hidden />
                ) : (
                  <Icon className="size-[18px] shrink-0 opacity-70" aria-hidden />
                )}
              </div>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold leading-tight", active ? "text-violet-950 dark:text-violet-50" : "text-zinc-900 dark:text-zinc-50")}>{label}</p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">{detail}</p>
                {key === "preparing" && supplierPreparingAt ? (
                  <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                    <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
                    Buyer pinged · {new Date(supplierPreparingAt).toLocaleString()}
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
                    <p className="text-xs font-medium text-violet-800 dark:text-violet-300">
                      Your wholesale (COGS): {formatStoreCurrencyFromCents(o.supplierNetCents)}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                      Retail price and partner margin are hidden on this view — only Affisell support can match a
                      partner using the listing reference below.
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
