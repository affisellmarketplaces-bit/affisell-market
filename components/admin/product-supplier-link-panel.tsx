"use client"

import { useCallback, useState } from "react"
import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminProductSupplierLinkRow } from "@/lib/admin/products/load-product-supplier-link"

type LinkState = {
  aeUrl: string
  aeProductId: string
  aeSkuId: string
  aeShopId: string
  aePriceCents: number
  aeShippingCents: number
  autoBuyEnabled: boolean
}

function initialLink(product: AdminProductSupplierLinkRow): LinkState {
  const sl = product.supplierLink
  return {
    aeUrl: sl?.aeUrl ?? product.sourceUrl ?? "",
    aeProductId: sl?.aeProductId ?? product.aliexpressProductId ?? "",
    aeSkuId: sl?.aeSkuId ?? "",
    aeShopId: sl?.aeShopId ?? "",
    aePriceCents: sl?.aePriceCents ?? 0,
    aeShippingCents: sl?.aeShippingCents ?? 0,
    autoBuyEnabled: sl?.autoBuyEnabled ?? product.autoFulfill,
  }
}

export function ProductSupplierLinkPanel({ product }: { product: AdminProductSupplierLinkRow }) {
  const [form, setForm] = useState<LinkState>(() => initialLink(product))
  const [busy, setBusy] = useState(false)
  const [resolveBusy, setResolveBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resolveFromUrl = useCallback(async () => {
    if (!form.aeUrl.trim()) return
    setResolveBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/resolve-ae-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aeUrl: form.aeUrl.trim() }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        resolved?: LinkState & { aeSkuId: string | null }
        error?: string
      }
      if (!res.ok || !data.ok || !data.resolved) {
        setError(data.error ?? "Résolution AliExpress impossible")
        return
      }
      setForm((f) => ({
        ...f,
        aeProductId: data.resolved!.aeProductId,
        aeSkuId: data.resolved!.aeSkuId ?? "",
        aeShopId: data.resolved!.aeShopId,
        aePriceCents: data.resolved!.aePriceCents,
        aeShippingCents: data.resolved!.aeShippingCents,
        aeUrl: data.resolved!.aeUrl,
      }))
      setMessage("Champs remplis depuis l’API AliExpress.")
    } finally {
      setResolveBusy(false)
    }
  }, [form.aeUrl, product.id])

  async function save() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/supplier-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aeUrl: form.aeUrl,
          aeProductId: form.aeProductId,
          aeSkuId: form.aeSkuId || null,
          aeShopId: form.aeShopId,
          aePriceCents: form.aePriceCents,
          aeShippingCents: form.aeShippingCents,
          autoBuyEnabled: form.autoBuyEnabled,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible")
        return
      }
      setMessage("Lien fournisseur enregistré.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Lien fournisseur (AliExpress)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Auto-buy à chaque commande payée — nécessite API AE ou worker Puppeteer.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="aeUrl">URL AliExpress</Label>
          <Input
            id="aeUrl"
            className="mt-1"
            value={form.aeUrl}
            onChange={(e) => setForm((f) => ({ ...f, aeUrl: e.target.value }))}
            onBlur={() => void resolveFromUrl()}
            placeholder="https://www.aliexpress.com/item/…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Product ID</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={form.aeProductId}
              onChange={(e) => setForm((f) => ({ ...f, aeProductId: e.target.value }))}
            />
          </div>
          <div>
            <Label>SKU ID</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={form.aeSkuId}
              onChange={(e) => setForm((f) => ({ ...f, aeSkuId: e.target.value }))}
            />
          </div>
          <div>
            <Label>Shop ID</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={form.aeShopId}
              onChange={(e) => setForm((f) => ({ ...f, aeShopId: e.target.value }))}
            />
          </div>
          <div>
            <Label>Prix achat (centimes)</Label>
            <Input
              type="number"
              className="mt-1"
              value={form.aePriceCents}
              onChange={(e) =>
                setForm((f) => ({ ...f, aePriceCents: Math.max(0, Number(e.target.value) || 0) }))
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium">Auto-Buy activé</p>
            <p className="text-xs text-zinc-500">Désactivé si DISABLE_AUTO_BUY=true côté serveur</p>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-zinc-300"
            checked={form.autoBuyEnabled}
            onChange={(e) => setForm((f) => ({ ...f, autoBuyEnabled: e.target.checked }))}
            aria-label="Auto-Buy activé"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => window.open(form.aeUrl, "_blank")}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Tester le lien
          </Button>
          <Button type="button" variant="secondary" disabled={resolveBusy} onClick={() => void resolveFromUrl()}>
            {resolveBusy ? "API…" : "Rafraîchir depuis AE"}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </section>
  )
}
