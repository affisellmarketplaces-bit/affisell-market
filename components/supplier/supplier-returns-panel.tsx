"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { RETURN_REASON_LABELS } from "@/lib/order-return-types"
import { cn } from "@/lib/utils"

type ReturnRow = {
  id: string
  status: string
  reasonCode: string
  reasonDetail: string | null
  evidenceUrls: unknown
  requestedRefundCents: number
  approvedRefundCents: number | null
  sellerNote: string | null
  rejectionReason: string | null
  buyerTrackingCarrier: string | null
  buyerTrackingNumber: string | null
  buyerShippedAt: string | null
  sellerRespondByAt: string | null
  receivedAt: string | null
  refundedAt: string | null
  createdAt: string
  order: {
    id: string
    customerEmail: string
    supplierNetCents: number
    partnerListingCode: string | null
    quantity: number
    orderedAt: string
    productName: string
    productImageUrl: string | null
  }
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    REQUESTED: "New request",
    AWAITING_SHIPMENT: "Waiting for buyer shipment",
    IN_TRANSIT: "In transit",
    RECEIVED: "Received",
    REFUNDED: "Refunded",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled (buyer)",
  }
  return m[s] ?? s
}

export function SupplierReturnsPanel({ className }: { className?: string }) {
  const [rows, setRows] = useState<ReturnRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [returnHint, setReturnHint] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch("/api/supplier/returns", { cache: "no-store" })
    if (!res.ok) {
      setError("Could not load returns")
      setRows([])
      return
    }
    setRows((await res.json()) as ReturnRow[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/store/logistics", { credentials: "include", cache: "no-store" })
        if (!res.ok) return
        const j = (await res.json()) as { returnFormatted?: string | null }
        if (j.returnFormatted?.trim()) {
          setReturnHint(j.returnFormatted.trim())
        } else {
          setReturnHint(null)
        }
      } catch {
        setReturnHint(null)
      }
    })()
  }, [])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/returns/${id}`, {
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
    } finally {
      setBusy(null)
    }
  }

  if (rows === null) {
    return <p className={cn("text-sm text-zinc-500", className)}>Loading…</p>
  }

  if (rows.length === 0) {
    return (
      <Card className={cn("border-zinc-200 p-8 text-center dark:border-zinc-700", className)}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No return requests yet.</p>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="border-violet-200/80 bg-gradient-to-r from-violet-50/80 to-white p-4 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Return receiving address
        </p>
        {returnHint ? (
          <pre className="mt-2 whitespace-pre-wrap text-sm leading-snug text-zinc-800 dark:text-zinc-200">
            {returnHint}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No return address on file yet. Add your warehouse / return address in store settings so you can paste it
            for buyers when you approve a return.
          </p>
        )}
        <Link
          href="/dashboard/supplier/settings/store"
          className="mt-3 inline-block text-sm font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        >
          Configure in store settings →
        </Link>
      </Card>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {rows.map((r) => (
        <Card key={r.id} className="border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex flex-wrap gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {r.order.productImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.order.productImageUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.order.productName}</p>
              <p className="text-xs text-zinc-500">
                {r.order.customerEmail} · ordered {new Date(r.order.orderedAt).toLocaleDateString()} · ×
                {r.order.quantity} · wholesale {formatStoreCurrencyFromCents(r.order.supplierNetCents)}
                {r.order.partnerListingCode ? (
                  <>
                    {" "}
                    · Partner listing{" "}
                    <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
                      {r.order.partnerListingCode}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-sm">
                <span className="text-zinc-500">Status: </span>
                <span className="font-medium">{statusLabel(r.status)}</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                Reason:{" "}
                {RETURN_REASON_LABELS[r.reasonCode as keyof typeof RETURN_REASON_LABELS]?.en ??
                  r.reasonCode}
                {r.reasonDetail ? ` — ${r.reasonDetail}` : ""}
              </p>
              {r.sellerRespondByAt && r.status === "REQUESTED" ? (
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  Respond by {new Date(r.sellerRespondByAt).toLocaleString()}
                </p>
              ) : null}
              {r.buyerTrackingNumber ? (
                <p className="mt-1 text-xs text-zinc-600">
                  Tracking: {r.buyerTrackingCarrier} {r.buyerTrackingNumber}
                </p>
              ) : null}
              {r.rejectionReason ? (
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">Rejection: {r.rejectionReason}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {r.status === "REQUESTED" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === r.id}
                  onClick={() =>
                    void patch(r.id, {
                      action: "approve",
                      approvedRefundCents: r.requestedRefundCents,
                    })
                  }
                >
                  Approve return
                </Button>
                <RejectButton returnId={r.id} busy={busy} onReject={(reason) => void patch(r.id, reason)} />
              </>
            ) : null}
            {r.status === "IN_TRANSIT" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy === r.id}
                onClick={() => void patch(r.id, { action: "mark_received" })}
              >
                Mark received
              </Button>
            ) : null}
            {r.status === "RECEIVED" ? (
              <Button
                type="button"
                size="sm"
                disabled={busy === r.id}
                onClick={() => void patch(r.id, { action: "mark_refunded" })}
              >
                Mark refunded
              </Button>
            ) : null}
            <p className="w-full text-xs text-zinc-500">
              Refunds are recorded here when you complete the payout (Stripe refund or manual). This does not
              call Stripe automatically.
            </p>
          </div>
        </Card>
      ))}
    </div>
  )
}

function RejectButton({
  returnId,
  busy,
  onReject,
}: {
  returnId: string
  busy: string | null
  onReject: (body: { action: string; rejectionReason: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Reject
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <input
        className="min-w-[200px] flex-1 rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-600"
        placeholder="Reason for buyer"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={busy === returnId}
        onClick={() => {
          onReject({ action: "reject", rejectionReason: reason })
          setOpen(false)
          setReason("")
        }}
      >
        Confirm reject
      </Button>
    </div>
  )
}
