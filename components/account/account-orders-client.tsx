"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { RETURN_REASON_CODES, RETURN_REASON_LABELS } from "@/lib/order-return-types"
import { cn } from "@/lib/utils"

type OrderRow = {
  id: string
  createdAt: string
  quantity: number
  sellingPriceCents: number
  status: string
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
      <Card className={cn("border-zinc-200 p-8 text-center dark:border-zinc-700", className)}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No orders yet for this account.</p>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-end gap-2 text-xs">
        <button
          type="button"
          className={cn(lang === "fr" ? "font-semibold text-violet-600" : "text-zinc-500")}
          onClick={() => setLang("fr")}
        >
          FR
        </button>
        <span className="text-zinc-300">|</span>
        <button
          type="button"
          className={cn(lang === "en" ? "font-semibold text-violet-600" : "text-zinc-500")}
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
        <Card key={o.id} className="border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {o.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- product URLs are supplier-controlled remotes
                <img src={o.product.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{o.product.name}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {new Date(o.createdAt).toLocaleDateString()} · ×{o.quantity} · {formatStoreCurrencyFromCents(o.sellingPriceCents)}
              </p>
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
        </Card>
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
