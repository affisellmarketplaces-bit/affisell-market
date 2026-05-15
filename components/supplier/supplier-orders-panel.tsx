"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type OrderRow = {
  id: string
  fulfillmentSource: "marketplace" | "blind_dropship"
  status: string
  displayStatus: string
  canMarkShipped: boolean
  quantity: number
  variantLabel: string | null
  customerEmail: string
  sellingPriceCents: number
  basePriceCents: number
  affisellFeeCents: number
  affiliateCommissionCents: number
  affiliateMarginRetainedCents: number
  supplierNetCents: number
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
  affiliate: {
    id: string
    name: string | null
    storeName: string | null
    storeSlug: string | null
  }
  openReturn: { id: string; status: string } | null
  payoutStatus: string
  payoutEligibleAt: string | null
  supplierPayoutAt: string | null
}

type Tab = "to_ship" | "shipped" | "all"

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

  async function markShipped(orderId: string) {
    const t = trackingByOrder[orderId]
    const trackingNumber = t?.number?.trim() ?? ""
    if (!trackingNumber) {
      setError("Enter a tracking number before marking as shipped.")
      return
    }
    setBusy(orderId)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_shipped",
          trackingNumber,
          ...(t?.carrier?.trim() ? { trackingCarrier: t.carrier.trim() } : {}),
        }),
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

  function setTracking(orderId: string, field: "carrier" | "number", value: string) {
    setTrackingByOrder((prev) => ({
      ...prev,
      [orderId]: {
        carrier: field === "carrier" ? value : (prev[orderId]?.carrier ?? ""),
        number: field === "number" ? value : (prev[orderId]?.number ?? ""),
      },
    }))
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
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              tab === t.id
                ? "bg-violet-600 text-white shadow-sm"
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
        <Card className="border-zinc-200 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {tab === "to_ship"
              ? "No orders waiting to ship. New marketplace sales will appear here automatically."
              : "No orders in this view."}
          </p>
        </Card>
      ) : (
        rows.map((o) => (
          <Card key={o.id} className="border-zinc-200 p-4 dark:border-zinc-700">
            <div className="flex flex-wrap gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {o.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.product.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{o.product.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {o.fulfillmentSource === "blind_dropship" ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
                        Blind dropship
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        o.status === "shipped"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                      )}
                    >
                      {o.displayStatus}
                    </span>
                  </div>
                </div>
                {o.variantLabel ? (
                  <p className="text-xs text-zinc-500">Variant: {o.variantLabel}</p>
                ) : null}
                {o.product.supplierSku ? (
                  <p className="text-xs text-zinc-500">SKU: {o.product.supplierSku}</p>
                ) : null}
                <p className="mt-1 text-xs text-zinc-500">
                  ×{o.quantity} · {new Date(o.createdAt).toLocaleString()}
                </p>
                <div className="mt-2 rounded-lg border border-zinc-100 bg-white/80 px-2.5 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">
                    Sale total {formatStoreCurrencyFromCents(o.sellingPriceCents)}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-zinc-600 dark:text-zinc-400">
                    <li>− Affisell marketplace (10%): {formatStoreCurrencyFromCents(o.affisellFeeCents)}</li>
                    <li>− Partner commission: {formatStoreCurrencyFromCents(o.affiliateCommissionCents)}</li>
                    {o.affiliateMarginRetainedCents > 0 ? (
                      <li>− Partner markup: {formatStoreCurrencyFromCents(o.affiliateMarginRetainedCents)}</li>
                    ) : null}
                    <li className="font-medium text-violet-800 dark:text-violet-300">
                      Your wholesale (COGS): {formatStoreCurrencyFromCents(o.supplierNetCents)}
                    </li>
                  </ul>
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Buyer: <span className="font-medium">{o.customerEmail}</span>
                  {o.affiliate.storeName ? (
                    <>
                      {" "}
                      · via{" "}
                      {o.affiliate.storeSlug ? (
                        <Link
                          href={`/store/${encodeURIComponent(o.affiliate.storeSlug)}`}
                          className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
                        >
                          {o.affiliate.storeName}
                        </Link>
                      ) : (
                        o.affiliate.storeName
                      )}
                    </>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Merchant payout: <span className="font-medium">{o.payoutStatus}</span>
                  {o.payoutEligibleAt && !o.supplierPayoutAt
                    ? ` · from ${new Date(o.payoutEligibleAt).toLocaleDateString()}`
                    : null}
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

            <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ship to</p>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-snug text-zinc-800 dark:text-zinc-200">
                {o.shippingAddressFormatted}
              </pre>
            </div>

            {o.status === "shipped" && o.trackingNumber ? (
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                Tracking: <span className="font-medium">{o.trackingCarrier ?? "Carrier"}</span>{" "}
                {o.trackingNumber}
                {o.shippedAt ? (
                  <span className="text-zinc-500"> · shipped {new Date(o.shippedAt).toLocaleString()}</span>
                ) : null}
              </p>
            ) : null}

            {o.canMarkShipped ? (
              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <label className="flex min-w-[120px] flex-col gap-1 text-xs text-zinc-500">
                  Carrier
                  <input
                    className="rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    placeholder="UPS, Colissimo…"
                    value={trackingByOrder[o.id]?.carrier ?? ""}
                    onChange={(e) => setTracking(o.id, "carrier", e.target.value)}
                  />
                </label>
                <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-zinc-500">
                  Tracking number *
                  <input
                    className="rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    placeholder="1Z999…"
                    value={trackingByOrder[o.id]?.number ?? ""}
                    onChange={(e) => setTracking(o.id, "number", e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === o.id}
                  onClick={() => void markShipped(o.id)}
                >
                  {busy === o.id ? "Saving…" : "Mark shipped"}
                </Button>
              </div>
            ) : null}
          </Card>
        ))
      )}
    </div>
  )
}
