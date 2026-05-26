"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Package, Sparkles } from "lucide-react"

import { AccountOrderFulfillmentPanel } from "@/components/account/account-order-fulfillment-panel"
import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { RETURN_REASON_CODES, RETURN_REASON_LABELS } from "@/lib/order-return-types"
import { cn } from "@/lib/utils"

type OrderRow = {
  id: string
  fulfillmentSource?: "marketplace" | "blind_dropship"
  createdAt: string
  quantity: number
  sellingPriceCents: number
  status: string
  supplierPreparingAt: string | null
  shippedAt: string | null
  trackingCarrier?: string | null
  trackingNumber?: string | null
  deliveredAt: string | null
  deliveryConfirmedAt: string | null
  canConfirmDelivery: boolean
  payoutEligibleAt: string | null
  payoutPolicy: { daysAfterConfirm: number; autoConfirmDays: number }
  product: { id: string; name: string; imageUrl: string | null }
  returnWindowEndsAt: string
  returnEligible: boolean
  activeReturn: {
    id: string
    status: string
    reasonCode: string
    createdAt: string
    sellerRespondByAt: string | null
    buyerTrackingCarrier: string | null
    buyerTrackingNumber: string | null
  } | null
  lastReturn: { id: string; status: string; createdAt: string; terminal: boolean } | null
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    REQUESTED: "Awaiting seller",
    AWAITING_SHIPMENT: "Ship item back",
    IN_TRANSIT: "Return in transit",
    RECEIVED: "Received — refund pending",
    REFUNDED: "Refunded",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  }
  return map[status] ?? status
}

function orderFulfillmentTag(status: string, lang: "en" | "fr") {
  if (status === "preparing") {
    return lang === "fr" ? " · Préparation en cours" : " · Preparing your order"
  }
  if (status === "shipped") {
    return lang === "fr" ? " · Expédiée" : " · Shipped"
  }
  if (status === "paid") {
    return lang === "fr" ? " · Confirmée" : " · Confirmed"
  }
  return ""
}

export function AccountOrdersClient({
  initialOrders,
  className,
}: {
  initialOrders: OrderRow[]
  className?: string
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [lang, setLang] = useState<"en" | "fr">("fr")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reasonOptions = useMemo(
    () => RETURN_REASON_CODES.map((code) => ({ code, label: RETURN_REASON_LABELS[code][lang] })),
    [lang]
  )

  async function refresh() {
    const res = await fetch("/api/account/orders", { cache: "no-store" })
    if (!res.ok) return
    const data = (await res.json()) as OrderRow[]
    setOrders(data)
  }

  if (orders.length === 0) {
    return (
      <BentoCard className={cn("py-12 text-center dark:border-zinc-800", className)}>
        <p className="text-sm text-gray-600 dark:text-zinc-400">No orders yet for this account.</p>
      </BentoCard>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-end gap-2 rounded-3xl border border-gray-100 bg-white/80 px-4 py-2 text-xs shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/70">
        <button
          type="button"
          className={cn(lang === "fr" ? "font-semibold text-[#7C3AED]" : "text-gray-500")}
          onClick={() => setLang("fr")}
        >
          FR
        </button>
        <span className="text-zinc-300">|</span>
        <button
          type="button"
          className={cn(lang === "en" ? "font-semibold text-[#7C3AED]" : "text-gray-500")}
          onClick={() => setLang("en")}
        >
          EN
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {orders.map((o) => (
        <BentoCard key={o.id} className="py-5 md:py-6">
          <div className="flex gap-5">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-800">
              {o.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- product URLs are supplier-controlled remotes
                <img src={o.product.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {o.product.name}
                {o.fulfillmentSource === "blind_dropship" ? (
                  <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                    Blind
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                {new Date(o.createdAt).toLocaleDateString()} · ×{o.quantity} · {formatStoreCurrencyFromCents(o.sellingPriceCents)}
                {orderFulfillmentTag(o.status, lang)}
              </p>
              {o.fulfillmentSource !== "blind_dropship" ? (
                <Link
                  href={`/marketplace/account/orders/${o.id}`}
                  className="mt-2 inline-block text-xs font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
                >
                  {lang === "fr" ? "Voir le détail et la facture →" : "View details & invoice →"}
                </Link>
              ) : null}
              {o.status === "preparing" ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/95 via-white to-violet-50 p-4 shadow-[0_18px_50px_-28px_rgba(14,165,233,0.55)] dark:border-sky-900/50 dark:from-sky-950/45 dark:via-zinc-950 dark:to-violet-950/40">
                  <div className="flex gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/80 bg-white/90 text-sky-700 shadow-inner dark:border-sky-800/80 dark:bg-sky-950/40 dark:text-sky-200">
                      <Package className="size-5 animate-[pulse_2.4s_ease-in-out_infinite]" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-sky-950 dark:text-sky-50">
                        <Sparkles className="size-3.5 text-sky-600 dark:text-sky-300" aria-hidden />
                        {lang === "fr" ? "Votre vendeur prépare l’envoi" : "Your seller is preparing shipment"}
                      </p>
                      <p className="text-xs leading-relaxed text-sky-900/85 dark:text-sky-100/80">
                        {lang === "fr"
                          ? "Le produit est pris en charge et emballé. Vous recevrez le suivi dès l’expédition."
                          : "They’ve confirmed your order is being packed. Tracking appears the moment the carrier scans the parcel."}
                      </p>
                      {o.supplierPreparingAt ? (
                        <p className="text-[11px] text-sky-800/70 dark:text-sky-200/70">
                          {lang === "fr" ? "Mise à jour" : "Since"}{" "}
                          {new Date(o.supplierPreparingAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {o.trackingNumber ? (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Tracking: {o.trackingCarrier ?? "Carrier"} {o.trackingNumber}
                </p>
              ) : null}
              {o.fulfillmentSource !== "blind_dropship" &&
              (o.status === "paid" || o.status === "preparing") ? (
                <AccountOrderFulfillmentPanel orderId={o.id} lang={lang} />
              ) : null}
              {o.canConfirmDelivery ? (
                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/80 p-3 dark:border-violet-900/50 dark:bg-violet-950/30">
                  <p className="text-sm text-violet-950 dark:text-violet-100">
                    Received and satisfied? Confirm delivery — seller payouts run after {o.payoutPolicy.daysAfterConfirm}{" "}
                    days. Without confirmation, payouts may still release after {o.payoutPolicy.autoConfirmDays} days from
                    shipment. Your statutory withdrawal right remains during the return window.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    disabled={busyId === o.id}
                    onClick={async () => {
                      setError(null)
                      setBusyId(o.id)
                      try {
                        const res = await fetch(`/api/account/orders/${o.id}/confirm-delivery`, {
                          method: "POST",
                        })
                        const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
                        if (!res.ok) {
                          setError(j.error ?? "Could not confirm")
                          return
                        }
                        await refresh()
                      } finally {
                        setBusyId(null)
                      }
                    }}
                  >
                    Confirm receipt & satisfaction
                  </Button>
                </div>
              ) : o.deliveryConfirmedAt ? (
                <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                  Delivery confirmed · {new Date(o.deliveryConfirmedAt).toLocaleDateString()}
                  {o.payoutEligibleAt
                    ? ` · merchant payouts from ${new Date(o.payoutEligibleAt).toLocaleDateString()}`
                    : null}
                </p>
              ) : null}
              {o.activeReturn ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    <span className="text-zinc-500">Return: </span>
                    <span className="font-medium">{statusLabel(o.activeReturn.status)}</span>
                  </p>
                  {o.activeReturn.status === "AWAITING_SHIPMENT" ? (
                    <TrackingForm
                      returnId={o.activeReturn.id}
                      busyId={busyId}
                      setBusyId={setBusyId}
                      setError={setError}
                      onDone={refresh}
                    />
                  ) : null}
                  {o.activeReturn.status === "REQUESTED" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      disabled={busyId === o.activeReturn.id}
                      onClick={async () => {
                        setError(null)
                        setBusyId(o.activeReturn!.id)
                        try {
                          const res = await fetch(`/api/account/order-returns/${o.activeReturn!.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "cancel" }),
                          })
                          if (!res.ok) {
                            const j = (await res.json().catch(() => ({}))) as { error?: string }
                            setError(j.error ?? "Could not cancel")
                            return
                          }
                          await refresh()
                        } finally {
                          setBusyId(null)
                        }
                      }}
                    >
                      Cancel request
                    </Button>
                  ) : null}
                </div>
              ) : o.returnEligible ? (
                <ReturnRequestForm
                  orderId={o.id}
                  reasonOptions={reasonOptions}
                  busyId={busyId}
                  setBusyId={setBusyId}
                  setError={setError}
                  onDone={refresh}
                />
              ) : o.lastReturn && o.lastReturn.terminal ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Last return: {statusLabel(o.lastReturn.status)} ·{" "}
                  {new Date(o.lastReturn.createdAt).toLocaleDateString()}
                </p>
              ) : !o.returnEligible ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Return window ended on {new Date(o.returnWindowEndsAt).toLocaleDateString()}.
                </p>
              ) : null}
            </div>
          </div>
        </BentoCard>
      ))}
    </div>
  )
}

function ReturnRequestForm({
  orderId,
  reasonOptions,
  busyId,
  setBusyId,
  setError,
  onDone,
}: {
  orderId: string
  reasonOptions: { code: string; label: string }[]
  busyId: string | null
  setBusyId: (id: string | null) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const [reasonCode, setReasonCode] = useState(reasonOptions[0]?.code ?? "OTHER")
  const [detail, setDetail] = useState("")

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-900/40">
      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Reason</label>
      <select
        className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        value={reasonCode}
        onChange={(e) => setReasonCode(e.target.value)}
      >
        {reasonOptions.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        rows={2}
        placeholder="Details (optional)"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={busyId === orderId}
        onClick={async () => {
          setError(null)
          setBusyId(orderId)
          try {
            const res = await fetch(`/api/account/orders/${orderId}/return`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reasonCode,
                reasonDetail: detail.trim() || undefined,
              }),
            })
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string }
              setError(j.error ?? "Request failed")
              return
            }
            await onDone()
          } finally {
            setBusyId(null)
          }
        }}
      >
        Request return
      </Button>
    </div>
  )
}

function TrackingForm({
  returnId,
  busyId,
  setBusyId,
  setError,
  onDone,
}: {
  returnId: string
  busyId: string | null
  setBusyId: (id: string | null) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const [carrier, setCarrier] = useState("")
  const [number, setNumber] = useState("")

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Ship the item to the address from your order confirmation, then add tracking here.
      </p>
      <input
        className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        placeholder="Carrier (e.g. Colissimo, Chronopost)"
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
      />
      <input
        className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        placeholder="Tracking number"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={busyId === returnId}
        onClick={async () => {
          setError(null)
          setBusyId(returnId)
          try {
            const res = await fetch(`/api/account/order-returns/${returnId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "submit_tracking",
                buyerTrackingCarrier: carrier,
                buyerTrackingNumber: number,
              }),
            })
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string }
              setError(j.error ?? "Could not save tracking")
              return
            }
            await onDone()
          } finally {
            setBusyId(null)
          }
        }}
      >
        Submit tracking
      </Button>
    </div>
  )
}
