"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ExternalLink, Loader2, Rocket, Store } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AFFISELL_AUTOBUY_SUPPLIER_EMAIL } from "@/lib/auto-buy-platform-supplier-shared"
import { cn } from "@/lib/utils"

type SupplierOption = {
  id: string
  name: string | null
  email: string
  storeSlug: string | null
  storeName: string | null
  isPlatformAutoBuy: boolean
}

type OwnerInfo = {
  id: string
  name: string | null
  email: string | null
  storeSlug: string | null
  storeName: string | null
}

type Props = {
  productId: string
  owner: OwnerInfo
  onPushed?: (payload: {
    supplierId: string
    storePath: string | null
    result: string
  }) => void
}

export function AdminPushToSupplierCard({ productId, owner, onPushed }: Props) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [targetId, setTargetId] = useState("")
  const [publish, setPublish] = useState(true)
  const [force, setForce] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [busy, setBusy] = useState(false)
  const [ownerState, setOwnerState] = useState(owner)

  useEffect(() => {
    setOwnerState(owner)
  }, [owner])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingList(true)
      try {
        const res = await fetch("/api/admin/supplier-boutiques", {
          credentials: "include",
          cache: "no-store",
        })
        const data = (await res.json()) as {
          ok?: boolean
          suppliers?: SupplierOption[]
        }
        if (!cancelled && res.ok && data.ok && Array.isArray(data.suppliers)) {
          setSuppliers(data.suppliers)
          const firstMerchant =
            data.suppliers.find((s) => !s.isPlatformAutoBuy && s.id !== owner.id) ??
            data.suppliers.find((s) => !s.isPlatformAutoBuy)
          if (firstMerchant) setTargetId(firstMerchant.id)
        }
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setLoadingList(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [owner.id])

  const target = useMemo(
    () => suppliers.find((s) => s.id === targetId) ?? null,
    [suppliers, targetId]
  )

  const isPlatformOwner =
    ownerState.email === AFFISELL_AUTOBUY_SUPPLIER_EMAIL ||
    ownerState.email === "import-vault@affisell.internal"

  const push = useCallback(async () => {
    if (!targetId) {
      toast.error("Choisissez une boutique fournisseur")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}/push-to-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetSupplierId: targetId,
          publish,
          force: force || undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        result?: string
        supplierId?: string
        storePath?: string | null
        storeSlug?: string | null
      }
      if (!res.ok || !data.ok) {
        const code = data.error ?? "push_failed"
        if (code === "ownership_conflict") {
          toast.error(
            "Produit déjà chez un autre fournisseur — cochez « Forcer » pour réassigner."
          )
        } else if (code === "supplier_not_found") {
          toast.error("Boutique fournisseur introuvable")
        } else {
          toast.error(code)
        }
        return
      }

      const labels: Record<string, string> = {
        reassigned: "Produit poussé sur la boutique",
        already_owned: "Déjà sur cette boutique",
        published_only: "Produit publié sur la boutique",
      }
      toast.success(labels[data.result ?? ""] ?? "Push OK")

      if (target) {
        setOwnerState({
          id: target.id,
          name: target.name,
          email: target.email,
          storeSlug: data.storeSlug ?? target.storeSlug,
          storeName: target.storeName,
        })
      }
      onPushed?.({
        supplierId: data.supplierId ?? targetId,
        storePath: data.storePath ?? null,
        result: data.result ?? "reassigned",
      })
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(false)
    }
  }, [force, onPushed, productId, publish, target, targetId])

  const ownerLabel =
    ownerState.name || ownerState.email || ownerState.id.slice(0, 10)
  const ownerShop = ownerState.storeSlug
    ? `/store/supplier/${ownerState.storeSlug}`
    : null

  return (
    <div className="space-y-4 rounded-xl border border-cyan-300/50 bg-gradient-to-br from-cyan-50/90 via-white to-violet-50/70 p-4 dark:border-cyan-900/60 dark:from-cyan-950/40 dark:via-zinc-950 dark:to-violet-950/30">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/25">
          <Rocket className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            Push boutique
          </p>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Envoyer vers une boutique fournisseur
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Réassigne le produit (lien AE + variantes conservés) sur la boutique de votre choix.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Propriétaire actuel
        </p>
        <p className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
          {ownerLabel}
          {isPlatformOwner ? (
            <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-700 dark:bg-violet-950 dark:text-violet-200">
              Plateforme
            </span>
          ) : null}
        </p>
        {ownerShop ? (
          <a
            href={ownerShop}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
          >
            <Store className="h-3 w-3" aria-hidden />
            {ownerShop}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="push-supplier" className="text-xs">
          Boutique destination
        </Label>
        {loadingList ? (
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Chargement des boutiques…
          </p>
        ) : (
          <select
            id="push-supplier"
            className="flex h-10 w-full rounded-md border border-cyan-200 bg-white px-3 text-sm dark:border-cyan-900 dark:bg-zinc-950"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={busy}
          >
            <option value="">— Choisir —</option>
            {suppliers
              .filter((s) => !s.isPlatformAutoBuy)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.storeName || s.name || s.email) +
                    (s.storeSlug ? ` · /store/supplier/${s.storeSlug}` : "")}
                </option>
              ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            disabled={busy}
          />
          Publier sur la boutique (actif)
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            disabled={busy}
          />
          Forcer (si déjà chez un autre fournisseur)
        </label>
      </div>

      <Button
        type="button"
        disabled={busy || !targetId || loadingList}
        onClick={() => void push()}
        className={cn(
          "w-full gap-2 bg-gradient-to-r from-cyan-600 to-violet-600 text-white hover:opacity-95 sm:w-auto"
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Rocket className="h-4 w-4" aria-hidden />
        )}
        {busy ? "Push en cours…" : "Push vers la boutique"}
      </Button>
    </div>
  )
}
