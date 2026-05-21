"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import type { AdminOrderDetail, AdminSupplierFulfillmentView } from "@/lib/admin/orders/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  orderId: string
  supplierOrders: AdminSupplierFulfillmentView[]
}

export function SupplierTimeline({ orderId, supplierOrders }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function syncTracking() {
    const res = await fetch(`/api/admin/orders/${orderId}/sync-tracking`, {
      method: "POST",
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      toast.error(data.error ?? "Sync failed")
      return
    }
    toast.success("Tracking mis à jour")
    router.refresh()
  }

  async function cancelSupplierOrder(jobId: string) {
    if (!confirm("Annuler cette commande fournisseur ?")) return
    setBusyId(jobId)
    try {
      const res = await fetch(`/api/admin/supplier-jobs/${jobId}/cancel`, {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Annulation impossible")
        return
      }
      toast.success("Commande fournisseur annulée")
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  if (supplierOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-zinc-500">
          Aucun job auto-order lié — vérifiez le batch ou le canal fournisseur.
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Fournisseurs</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void syncTracking()}>
          Rafraîchir tracking
        </Button>
      </div>

      {supplierOrders.map((sfo) => (
        <Card key={sfo.id}>
          <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">{sfo.supplierName}</Badge>
                  <span className="text-xs font-normal text-zinc-500">{sfo.channelType}</span>
                </CardTitle>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Status : <strong>{sfo.status}</strong>
                  {sfo.supplierOrderId ? (
                    <span className="ml-2 text-xs text-zinc-500">· {sfo.supplierOrderId}</span>
                  ) : null}
                </p>
                {sfo.errorMessage ? (
                  <p className="mt-1 text-xs text-red-600">{sfo.errorMessage}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!sfo.canCancel || busyId === sfo.id}
                onClick={() => void cancelSupplierOrder(sfo.id)}
              >
                {busyId === sfo.id ? "…" : "Annuler"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {sfo.trackingNumber ? (
              <p className="text-sm">
                {sfo.trackingUrl ? (
                  <a
                    href={sfo.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-violet-600 hover:underline dark:text-violet-400"
                  >
                    {sfo.carrier ? `${sfo.carrier} — ` : ""}
                    {sfo.trackingNumber}
                  </a>
                ) : (
                  <span>
                    {sfo.carrier ? `${sfo.carrier} — ` : ""}
                    {sfo.trackingNumber}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Pas encore de numéro de suivi.</p>
            )}
            <p className="mt-2 text-xs text-zinc-500">Paiement : {sfo.paymentMethod}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
