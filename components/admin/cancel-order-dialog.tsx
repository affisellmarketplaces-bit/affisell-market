"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { AdminSupplierFulfillmentView } from "@/lib/admin/orders/types"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"

type Props = {
  orderId: string
  supplierOrders: AdminSupplierFulfillmentView[]
}

/** Annule tous les jobs fournisseurs encore annulables (SAV). */
export function CancelOrderDialog({ orderId, supplierOrders }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const cancellable = supplierOrders.filter((s) => s.canCancel)

  async function cancelAll() {
    if (!confirm("Annuler cette commande et notifier le client par email ?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; emailSent?: boolean }
      if (!res.ok) {
        toast.error(data.error ?? "Annulation impossible")
        return
      }
      toast.success(
        data.emailSent
          ? "Commande annulée — email client envoyé"
          : "Commande annulée (email déjà envoyé ou indisponible)"
      )
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={cancellable.length === 0}
        onClick={() => setOpen(true)}
      >
        Annuler commandes fournisseur
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-md p-6">
          <h2 className="text-lg font-semibold">Annulation SAV</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Commande marketplace <code className="text-xs">{orderId.slice(0, 12)}…</code>
          </p>
          <p className="mt-4 text-sm">
            {cancellable.length} job(s) annulable(s). Les colis déjà expédiés ne peuvent pas être
            annulés via l&apos;API.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="mt-6"
            disabled={busy}
            onClick={() => void cancelAll()}
          >
            {busy ? "Annulation…" : "Confirmer l'annulation"}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}
