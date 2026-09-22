"use client"

import { Check, ExternalLink, Loader2, Package, RefreshCw, Truck } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ShipTrackingCarrierPicker } from "@/components/supplier/ship-tracking-carrier-picker"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { shipTrackingErrorMessage } from "@/lib/ship-tracking-error-i18n"
import { resolveShipTrackingPolicy } from "@/lib/ship-tracking-policy.shared"
import { validateShipTrackingFormat } from "@/lib/ship-tracking-validate.shared"
import { defaultTrustedCarrierLabel } from "@/lib/trusted-carriers-shared"
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
  shippingCountryIso2: string
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

type ValidationState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid" }
  | { status: "invalid"; code: string; params?: Record<string, string> }

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
  const tTrackingError = useTranslations("supplierOrders.trackingErrors")
  const shipTrackingPolicy = resolveShipTrackingPolicy()
  const [groups, setGroups] = useState<FulfillmentGroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [trackingDraft, setTrackingDraft] = useState<Record<string, { carrier: string; number: string }>>({})
  const [validation, setValidation] = useState<Record<string, ValidationState>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const validateTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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

  useEffect(() => {
    return () => {
      for (const timer of Object.values(validateTimers.current)) clearTimeout(timer)
    }
  }, [])

  function draftFor(groupId: string, countryIso2: string) {
    return (
      trackingDraft[groupId] ?? {
        carrier: defaultTrustedCarrierLabel(countryIso2),
        number: "",
      }
    )
  }

  function scheduleValidation(groupId: string, carrier: string, number: string, orderId: string) {
    if (validateTimers.current[groupId]) clearTimeout(validateTimers.current[groupId])

    const trimmed = number.trim()
    if (!carrier.trim() || !trimmed) {
      setValidation((prev) => ({ ...prev, [groupId]: { status: "idle" } }))
      return
    }

    const local = validateShipTrackingFormat({
      trackingCarrier: carrier,
      trackingNumber: trimmed,
      policy: shipTrackingPolicy,
    })
    if (!local.ok) {
      setValidation((prev) => ({ ...prev, [groupId]: { status: "invalid", code: local.code, params: local.params } }))
      return
    }

    setValidation((prev) => ({ ...prev, [groupId]: { status: "checking" } }))
    validateTimers.current[groupId] = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/supplier/orders/validate-tracking", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, trackingCarrier: carrier.trim(), trackingNumber: trimmed }),
          })
          const json = (await res.json()) as {
            valid?: boolean
            code?: string
            params?: Record<string, string>
          }
          setValidation((prev) => ({
            ...prev,
            [groupId]: json.valid
              ? { status: "valid" }
              : { status: "invalid", code: json.code ?? "tracking_not_recognized", params: json.params },
          }))
        } catch {
          setValidation((prev) => ({ ...prev, [groupId]: { status: "valid" } }))
        }
      })()
    }, 480)
  }

  function setDraft(group: FulfillmentGroupRow, field: "carrier" | "number", value: string) {
    const current = draftFor(group.id, group.shippingCountryIso2)
    const next = { ...current, [field]: value }
    setTrackingDraft((prev) => ({ ...prev, [group.id]: next }))
    scheduleValidation(group.id, next.carrier, next.number, group.items[0]?.orderId ?? group.id)
  }

  async function submitTracking(group: FulfillmentGroupRow) {
    const draft = draftFor(group.id, group.shippingCountryIso2)
    if (!draft.carrier.trim()) {
      toast.error(shipTrackingErrorMessage(tTrackingError, "carrier_required"))
      return
    }
    if (!draft.number.trim()) {
      toast.error(shipTrackingErrorMessage(tTrackingError, "tracking_required"))
      return
    }
    const v = validation[group.id]
    if (v?.status === "invalid") {
      toast.error(shipTrackingErrorMessage(tTrackingError, v.code, v.params))
      return
    }
    if (v?.status === "checking") {
      toast.error(t("loading"))
      return
    }
    setBusyId(group.id)
    try {
      const res = await fetch(`/api/fulfillment/${group.id}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingCarrier: draft.carrier.trim(),
          trackingNumber: draft.number.trim(),
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { code?: string }
        toast.error(shipTrackingErrorMessage(tTrackingError, err.code))
        return
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
        const draft = draftFor(group.id, group.shippingCountryIso2)
        const v = validation[group.id]

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
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-start">
                  <ShipTrackingCarrierPicker
                    value={draft.carrier}
                    onValueChange={(value) => setDraft(group, "carrier", value)}
                    countryIso2={group.shippingCountryIso2}
                    policy={shipTrackingPolicy}
                    disabled={busyId === group.id}
                    ariaLabel={t("carrierPlaceholder")}
                    placeholder={t("carrierPlaceholder")}
                    className="h-9 w-full"
                  />
                  <div className="relative">
                    <Input
                      className={cn(
                        "h-9 w-full pr-8",
                        v?.status === "invalid"
                          ? "border-red-300 dark:border-red-800"
                          : v?.status === "valid"
                            ? "border-emerald-300 dark:border-emerald-800"
                            : undefined
                      )}
                      placeholder={t("trackingPlaceholder")}
                      aria-invalid={v?.status === "invalid"}
                      value={draft.number}
                      onChange={(e) => setDraft(group, "number", e.target.value)}
                    />
                    {v?.status === "checking" ? (
                      <Loader2
                        className="pointer-events-none absolute right-2.5 top-2 size-4 animate-spin text-violet-500"
                        aria-hidden
                      />
                    ) : v?.status === "valid" ? (
                      <Check
                        className="pointer-events-none absolute right-2.5 top-2 size-4 text-emerald-600"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === group.id || v?.status === "checking" || v?.status === "invalid"}
                    onClick={() => void submitTracking(group)}
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
                {v?.status === "invalid" ? (
                  <p className="text-[11px] leading-snug text-red-600 dark:text-red-400" role="alert">
                    {shipTrackingErrorMessage(tTrackingError, v.code, v.params)}
                  </p>
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
