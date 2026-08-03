"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

type EnlistSuccess = {
  ok: true
  productId: string
  created: boolean
  aeProductId: string
  aeSkuId: string | null
  aePriceCents: number
  name: string
  autoBuyEnabled: boolean
  source: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnlisted: (productId: string) => void
}

export function AutoFulfillEnlistSheet({ open, onOpenChange, onEnlisted }: Props) {
  const [aeUrl, setAeUrl] = useState("")
  const [name, setName] = useState("")
  const [wholesaleEur, setWholesaleEur] = useState("")
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<EnlistSuccess | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) {
      setAeUrl("")
      setName("")
      setWholesaleEur("")
      setAutoBuyEnabled(true)
      setError(null)
      setSuccess(null)
    }
  }, [open])

  const submit = useCallback(() => {
    setError(null)
    setSuccess(null)
    const url = aeUrl.trim()
    if (!url) {
      setError("Colle une URL AliExpress (ou un product id).")
      return
    }

    let wholesalePriceCents: number | undefined
    if (wholesaleEur.trim()) {
      const n = Number.parseFloat(wholesaleEur.replace(",", "."))
      if (!Number.isFinite(n) || n <= 0) {
        setError("Prix wholesale invalide.")
        return
      }
      wholesalePriceCents = Math.round(n * 100)
    }

    startTransition(() => {
      void (async () => {
        try {
          const res = await fetch("/api/admin/auto-fulfill/enlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              aeUrl: url,
              name: name.trim() || undefined,
              wholesalePriceCents,
              autoBuyEnabled,
              publish: true,
            }),
          })
          const body = (await res.json()) as EnlistSuccess | { ok?: false; error?: string }
          if (!res.ok || !("ok" in body) || body.ok !== true) {
            const code = "error" in body ? body.error : "enlist_failed"
            const labels: Record<string, string> = {
              invalid_aliexpress_url: "URL / product id AliExpress invalide",
              supplier_not_found: "Fournisseur introuvable",
              Invalid: "Résolution AE impossible",
            }
            setError(
              (code && labels[code]) ||
                (typeof code === "string" ? code : "Échec enlist") ||
                "Échec enlist"
            )
            return
          }
          setSuccess(body)
          onEnlisted(body.productId)
        } catch {
          setError("Erreur réseau")
        }
      })()
    })
  }, [aeUrl, name, wholesaleEur, autoBuyEnabled, onEnlisted])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col overflow-y-auto border-l border-violet-200/60 bg-gradient-to-b from-white via-white to-violet-50/40 p-0 dark:border-violet-900/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/20"
      >
        <div className="relative overflow-hidden border-b border-violet-100 px-6 pb-5 pt-6 dark:border-violet-900/40">
          <div className={cn(affisellBrand.gradientBar, "absolute inset-x-0 top-0 h-1")} aria-hidden />
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/30">
              <Zap className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
                Instant Enlist
              </p>
              <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                Ajouter un produit Auto-Buy
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Colle une URL AliExpress — le produit est créé sur le compte{" "}
                <span className="font-semibold text-violet-700 dark:text-violet-300">
                  Affisell AutoBuy
                </span>{" "}
                et publié pour les resellers (catalogue affilié).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-6 py-5">
          {success ? (
            <div className="space-y-4 rounded-2xl border border-emerald-300/70 bg-emerald-50/90 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <p className="text-sm font-bold">
                  {success.created ? "Produit créé" : "Produit existant mis à jour"}
                </p>
              </div>
              <dl className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Nom</dt>
                  <dd className="truncate font-medium">{success.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">AE product</dt>
                  <dd className="font-mono text-[10px]">{success.aeProductId}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">SKU</dt>
                  <dd className="font-mono text-[10px]">{success.aeSkuId ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Prix achat</dt>
                  <dd className="font-semibold tabular-nums">
                    {(success.aePriceCents / 100).toFixed(2)} €
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Source</dt>
                  <dd>{success.source}</dd>
                </div>
              </dl>
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href={`/admin/products/${success.productId}`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "justify-center gap-2 rounded-full bg-violet-600 hover:bg-violet-700"
                  )}
                >
                  Configurer SKUs / variantes
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setSuccess(null)
                    setAeUrl("")
                    setName("")
                    setWholesaleEur("")
                  }}
                >
                  Enlister un autre
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="enlist-ae-url" className="text-xs font-bold uppercase tracking-wide">
                  URL AliExpress
                </Label>
                <Input
                  id="enlist-ae-url"
                  value={aeUrl}
                  onChange={(e) => setAeUrl(e.target.value)}
                  placeholder="https://www.aliexpress.com/item/3256807186698889.html"
                  className="rounded-xl border-violet-200/80 dark:border-violet-900/50"
                  autoFocus
                />
                <p className="text-[11px] text-zinc-500">
                  Product id seul accepté aussi (ex. <code>3256807186698889</code>).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enlist-name" className="text-xs font-bold uppercase tracking-wide">
                  Nom (optionnel)
                </Label>
                <Input
                  id="enlist-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto — titre AE si disponible"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="enlist-wholesale" className="text-xs font-bold uppercase tracking-wide">
                  Prix wholesale HT € (optionnel)
                </Label>
                <Input
                  id="enlist-wholesale"
                  inputMode="decimal"
                  value={wholesaleEur}
                  onChange={(e) => setWholesaleEur(e.target.value)}
                  placeholder="Auto — prix AE résolu"
                  className="rounded-xl"
                />
              </div>

              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-violet-600"
                  checked={autoBuyEnabled}
                  onChange={(e) => setAutoBuyEnabled(e.target.checked)}
                />
                <span className="font-medium text-zinc-800 dark:text-zinc-100">
                  Auto-Buy ON dès l’enlist
                </span>
              </label>

              <div className="rounded-xl border border-dashed border-violet-300/70 bg-violet-50/50 px-3 py-2.5 text-[11px] leading-relaxed text-violet-900 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Propriétaire catalogue
                </p>
                <p className="mt-1 opacity-90">
                  Sans fournisseur choisi → vault plateforme{" "}
                  <strong>Affisell Import Vault</strong> (idempotent). Tu pourras rattacher un
                  vrai supplier plus tard.
                </p>
              </div>

              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                disabled={pending}
                onClick={submit}
                className="mt-auto gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 py-5 text-sm font-bold shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-cyan-400"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Link2 className="h-4 w-4" aria-hidden />
                )}
                {pending ? "Résolution AE…" : "Enlister pour Auto-Buy"}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function AutoFulfillEnlistTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-500/30 transition",
        "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 hover:brightness-110"
      )}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition duration-700 group-hover:translate-x-full" />
      <Plus className="relative h-4 w-4" aria-hidden />
      <span className="relative">Ajouter un produit Auto-Buy</span>
    </button>
  )
}
