"use client"

import { ExternalLink, Loader2, Package, RefreshCw, Truck } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FulfillmentGroupRow = {
  id: string
  status: string
  externalOrderId: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  trackingUrl: string | null
  error: string | null
  manualNote: string | null
  provider: string | null
  createdAt: string
  items: Array<{
    orderId: string
    quantity: number
    order: {
      productName: string
      variantLabel: string | null
    }
  }>
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  AUTO_BUYING: "Auto-buying…",
  AWAITING_SHIPMENT: "Awaiting shipment",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
}

export function SupplierFulfillmentGroupsPanel() {
  const [groups, setGroups] = useState<FulfillmentGroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [trackingDraft, setTrackingDraft] = useState<Record<string, { carrier: string; number: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/supplier/fulfillment-groups", { cache: "no-store" })
      if (!res.ok) throw new Error("load_failed")
      const json = (await res.json()) as { groups: FulfillmentGroupRow[] }
      setGroups(json.groups ?? [])
    } catch {
      toast.error("Could not load fulfillment groups")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function submitTracking(groupId: string) {
    const draft = trackingDraft[groupId]
    if (!draft?.number.trim() || !draft.carrier.trim()) {
      toast.error("Carrier and tracking number required")
      return
    }
    setBusyId(groupId)
    try {
      const res = await fetch(`/api/fulfillment/${groupId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingCarrier: draft.carrier.trim(),
          trackingNumber: draft.number.trim(),
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "update_failed")
      }
      toast.success("Tracking saved — buyer notified")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    } finally {
      setBusyId(null)
    }
  }

  async function retryAutoBuy(groupId: string) {
    setBusyId(groupId)
    try {
      const res = await fetch(`/api/fulfillment/${groupId}/tracking`, { method: "PATCH" })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "retry_failed")
      }
      toast.success("Auto-buy retry queued")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <BentoCard className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading fulfillment parcels…
      </BentoCard>
    )
  }

  if (groups.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Fulfillment parcels (split orders)</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {groups.map((group) => {
        const canTrack =
          group.status === "AWAITING_SHIPMENT" ||
          group.status === "FAILED" ||
          group.status === "PENDING"
        const draft = trackingDraft[group.id] ?? { carrier: "", number: "" }

        return (
          <BentoCard key={group.id} className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.provider ?? "Manual"} · {STATUS_LABEL[group.status] ?? group.status}
                </p>
                <p className="mt-1 font-medium">
                  {group.items.map((i) => i.order.productName).join(", ")}
                </p>
                {group.externalOrderId ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    External order #{group.externalOrderId}
                  </p>
                ) : null}
                {group.error ? (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{group.error}</p>
                ) : null}
                {group.manualNote ? (
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{group.manualNote}</p>
                ) : null}
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  group.status === "SHIPPED" || group.status === "DELIVERED"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    : group.status === "FAILED"
                      ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                      : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                )}
              >
                {STATUS_LABEL[group.status] ?? group.status}
              </span>
            </div>

            {group.trackingNumber ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Truck className="size-4 text-muted-foreground" aria-hidden />
                <span>
                  {group.trackingCarrier} · {group.trackingNumber}
                </span>
                {group.trackingUrl ? (
                  <Link
                    href={group.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
                  >
                    Track
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </div>
            ) : canTrack ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <Input
                  placeholder="Carrier (e.g. Colissimo)"
                  value={draft.carrier}
                  onChange={(e) =>
                    setTrackingDraft((prev) => ({
                      ...prev,
                      [group.id]: { ...draft, carrier: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Tracking number"
                  value={draft.number}
                  onChange={(e) =>
                    setTrackingDraft((prev) => ({
                      ...prev,
                      [group.id]: { ...draft, number: e.target.value },
                    }))
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === group.id}
                  onClick={() => void submitTracking(group.id)}
                >
                  {busyId === group.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <Package className="size-4" aria-hidden />
                      Add tracking
                    </>
                  )}
                </Button>
                {group.status === "FAILED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === group.id}
                    onClick={() => void retryAutoBuy(group.id)}
                  >
                    <RefreshCw className="size-4" aria-hidden />
                    Retry auto-buy
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <Link
                  key={item.orderId}
                  href={`/dashboard/supplier/orders?highlight=${item.orderId}`}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Order {item.orderId.slice(-6)} · qty {item.quantity}
                </Link>
              ))}
            </div>
          </BentoCard>
        )
      })}
    </div>
  )
}
