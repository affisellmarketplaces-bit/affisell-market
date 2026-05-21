"use client"

import { useState } from "react"
import { toast } from "sonner"

import type { ProviderListRow } from "@/lib/admin/providers/serialize"
import { ProviderForm } from "@/components/admin/provider-form"
import {
  FulfillmentPaymentMethod,
  SupplierChannelType,
} from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent } from "@/components/ui/sheet"

type Props = {
  provider: ProviderListRow
  onUpdated?: () => void
}

export function ProviderEditDialog({ provider, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [sealKey, setSealKey] = useState("")
  const [sealSecret, setSealSecret] = useState("")
  const [sealing, setSealing] = useState(false)

  async function sealCredentials() {
    if (!sealKey.trim() && !sealSecret.trim()) {
      toast.error("Saisissez au moins une clé")
      return
    }
    setSealing(true)
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/seal-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: sealKey, apiSecret: sealSecret }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        toast.error(data.message ?? "Échec du seal")
        return
      }
      toast.success("Credentials sealed (AES-256-GCM)")
      setSealKey("")
      setSealSecret("")
      onUpdated?.()
    } finally {
      setSealing(false)
    }
  }

  async function disableProvider() {
    const res = await fetch(`/api/admin/providers/${provider.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "DISABLED" }),
    })
    if (!res.ok) {
      toast.error("Impossible de désactiver")
      return
    }
    toast.success("Fournisseur désactivé")
    setOpen(false)
    onUpdated?.()
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto p-6 sm:max-w-xl">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{provider.name}</h2>
          <p className="mt-1 text-xs text-zinc-500">{provider.slug}</p>

          <ProviderForm
            mode="edit"
            providerId={provider.id}
            compact
            defaultValues={{
              name: provider.name,
              type: provider.type as SupplierChannelType,
              apiEndpoint: provider.apiEndpoint ?? "",
              paymentMethod: provider.paymentMethod as FulfillmentPaymentMethod,
            }}
            onSuccess={() => {
              setOpen(false)
              onUpdated?.()
            }}
            onCancel={() => setOpen(false)}
          />

          <fieldset className="mt-6 space-y-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900 dark:bg-violet-950/20">
            <legend className="px-1 text-sm font-semibold">Seal keys</legend>
            <Input
              type="password"
              placeholder="API key"
              value={sealKey}
              onChange={(e) => setSealKey(e.target.value)}
              autoComplete="off"
            />
            <Input
              type="password"
              placeholder="API secret"
              value={sealSecret}
              onChange={(e) => setSealSecret(e.target.value)}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="bentoAccent"
              size="sm"
              disabled={sealing}
              onClick={() => void sealCredentials()}
            >
              {sealing ? "Sealing…" : "Seal Keys"}
            </Button>
          </fieldset>

          {provider.lifecycleStatus !== "DISABLED" ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mt-4"
              onClick={() => void disableProvider()}
            >
              Disable
            </Button>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
