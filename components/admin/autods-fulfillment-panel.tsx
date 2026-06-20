"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import type { AdminOrderDetail } from "@/lib/admin/orders/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const OPEN_STATUSES = new Set(["PENDING", "PROCESSING"])

type Props = {
  order: Pick<
    AdminOrderDetail,
    | "id"
    | "autodsOrderId"
    | "autodsStatus"
    | "autodsTracking"
    | "autodsTrackingUrl"
    | "autodsCarrier"
  >
}

function statusVariant(status: string | null): "outline" | "accent" | "destructive" {
  if (!status) return "outline"
  if (status === "FAILED") return "destructive"
  if (status === "SHIPPED" || status === "DELIVERED") return "accent"
  return "outline"
}

export function AutodsFulfillmentPanel({ order }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!order.autodsOrderId) return null

  async function resyncAutoDs() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/resync-autods`, {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        result?: { updated?: boolean; skipped?: string }
      }
      if (!res.ok) {
        toast.error(data.error ?? "Resync AutoDS impossible")
        return
      }
      if (data.result?.updated) {
        toast.success("AutoDS mis à jour")
      } else {
        toast.message("AutoDS déjà à jour", {
          description: data.result?.skipped ?? "Aucun changement",
        })
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const status = order.autodsStatus ?? "PENDING"

  return (
    <Card className="mb-8">
      <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              AutoDS
              <Badge variant={statusVariant(status)}>{status}</Badge>
              {OPEN_STATUSES.has(status) ? (
                <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                  en cours
                </span>
              ) : null}
            </CardTitle>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              ID AutoDS : <code className="text-xs">{order.autodsOrderId}</code>
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void resyncAutoDs()}>
            {busy ? "…" : "Resync AutoDS"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {order.autodsTracking ? (
          <p className="text-sm">
            {order.autodsTrackingUrl ? (
              <a
                href={order.autodsTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                {order.autodsCarrier ? `${order.autodsCarrier} — ` : ""}
                {order.autodsTracking}
              </a>
            ) : (
              <span>
                {order.autodsCarrier ? `${order.autodsCarrier} — ` : ""}
                {order.autodsTracking}
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">Pas encore de numéro de suivi AutoDS.</p>
        )}
      </CardContent>
    </Card>
  )
}
