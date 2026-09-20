"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type Props = {
  orderId: string
  supplierEmail: string
  supplierEmailSentAt: string | null
}

export function ResendSupplierAlertButton({
  orderId,
  supplierEmail,
  supplierEmailSentAt,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onResend() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resend-merchant-alerts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "supplier" }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        result?: { supplier?: string; supplierError?: string; supplierResendId?: string }
        supplierEmail?: string
      }
      if (!res.ok) {
        toast.error(data.error ?? "Renvoi mail fournisseur impossible")
        return
      }
      const status = data.result?.supplier
      if (status === "sent") {
        toast.success(`Mail fournisseur renvoyé → ${data.supplierEmail ?? supplierEmail}`, {
          description: data.result?.supplierResendId
            ? `Resend ${data.result.supplierResendId}`
            : undefined,
        })
      } else if (status === "failed") {
        toast.error(data.result?.supplierError ?? "Resend a refusé l'envoi")
      } else {
        toast.message(`Statut: ${status ?? "unknown"}`)
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onResend}>
        {busy ? "Envoi…" : "Renvoyer mail fournisseur"}
      </Button>
      <p className="max-w-[14rem] text-right text-[11px] text-zinc-500 dark:text-zinc-400">
        {supplierEmail}
        {supplierEmailSentAt
          ? ` · marqué envoyé ${new Date(supplierEmailSentAt).toLocaleString("fr-FR")}`
          : " · jamais marqué envoyé"}
      </p>
    </div>
  )
}
