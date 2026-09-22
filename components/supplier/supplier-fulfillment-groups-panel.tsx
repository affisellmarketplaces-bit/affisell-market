"use client"

import { ExternalLink, Loader2, Package, RefreshCw, Truck } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

type TFn = ReturnType<typeof useTranslations<"supplierOrders.splitGroups">>

const STATUS_KEY: Record<string, string> = {
  PENDING: "statusPending",
  AUTO_BUYING: "statusAutoBuying",
  AWAITING_SHIPMENT: "statusAwaiting",
  SHIPPED: "statusShipped",
  DELIVERED: "statusDelivered",
  FAILED: "statusFailed",
  CANCELLED: "statusCancelled",
}

function statusLabel(status: string, t: TFn): string {
  const key = STATUS_KEY[status]
  return key ? t(key) : status
}

export function SupplierFulfillmentGroupsPanel() {
  const t = useTranslations("supplierOrders.splitGroups")
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
      toast.error(t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  async function submitTracking(groupId: string) {
    const draft = trackingDraft[groupId]
    if (!draft?.number.trim() || !draft.carrier.trim()) {
      toast.error(t("carrierRequired"))
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
      toast.success(t("trackingSaved"))
      await load()
    } catch {
      toast.error(t("updateFailed"))
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
      toast.success(t("retryQueued"))
      await load()
    } catch {
      toast.error(t("retryFailed"))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center gap-2 border-zinc-200/90 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("loading")}
      </Card>
    )
  }

  if (groups.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{t("title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void load()}>
          <RefreshCw className="size-3.5" aria-hidden />
          {t("refresh")}
        </Button>
      </div>

      {groups.map((group) => {
        const canTrack =
          group.status === "AWAITING_SHIPMENT" ||
          group.status === "FAILED" ||
          group.status === "PENDING"
        const draft = trackingDraft[group.id] ?? { carrier: "", number: "" }

        return (
          <Card key={group.id} className="space-y-4 border-zinc-200/90 p-5 dark:border-zinc-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {group.provider ?? t("provider")} · {statusLabel(group.status, t)}
                </p>
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                  {group.items.map((i) => i.order.productName).join(", ")}
                </p>
                {group.externalOrderId ? (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {t("externalOrderRef", { id: group.externalOrderId })}
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
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  group.status === "SHIPPED" || group.status === "DELIVERED"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    : group.status === "FAILED"
                      ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                      : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                )}
              >
                {statusLabel(group.status, t)}
              </span>
            </div>

            {group.trackingNumber ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Truck className="size-4 text-zinc-400" aria-hidden />
                <span className="text-zinc-800 dark:text-zinc-200">
                  {group.trackingCarrier} · {group.trackingNumber}
                </span>
                {group.trackingUrl ? (
                  <Link
                    href={group.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
                  >
                    {t("track")}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </div>
            ) : canTrack ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <Input
                  placeholder={t("carrierPlaceholder")}
                  value={draft.carrier}
                  onChange={(e) =>
                    setTrackingDraft((prev) => ({
                      ...prev,
                      [group.id]: { ...draft, carrier: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder={t("trackingPlaceholder")}
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
                      {t("addTracking")}
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
                    {t("retryAutoBuy")}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <Link
                  key={item.orderId}
                  href={`/dashboard/supplier/orders?highlight=${item.orderId}`}
                  className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("orderRef", { id: item.orderId.slice(-6), qty: item.quantity })}
                </Link>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
