"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, KeyRound, Loader2, Puzzle, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TokenRow = {
  id: string
  label: string
  createdAt: string
  lastUsedAt: string | null
}

export function SupplierExtensionConnect() {
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState("Chrome")
  const [freshToken, setFreshToken] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/supplier/extension/token", { credentials: "include" })
      const data = (await res.json()) as { tokens?: TokenRow[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Erreur")
      setTokens(Array.isArray(data.tokens) ? data.tokens : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de charger les jetons")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createToken = async () => {
    setCreating(true)
    setFreshToken(null)
    try {
      const res = await fetch("/api/supplier/extension/token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || "Chrome" }),
      })
      const data = (await res.json()) as { token?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Échec")
      if (!data.token) throw new Error("Jeton manquant")
      setFreshToken(data.token)
      toast.success("Jeton créé — copiez-le dans l’extension.")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec")
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string) => {
    try {
      const res = await fetch("/api/supplier/extension/token", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Échec")
      toast.success("Jeton révoqué")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec")
    }
  }

  const copyToken = async () => {
    if (!freshToken) return
    try {
      await navigator.clipboard.writeText(freshToken)
      toast.success("Copié")
    } catch {
      toast.error("Copie impossible")
    }
  }

  return (
    <Card className="border-violet-200/80 bg-gradient-to-br from-white via-violet-50/40 to-white p-6 shadow-sm dark:border-violet-900/40 dark:from-zinc-950 dark:via-violet-950/20 dark:to-zinc-950">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/30">
          <Puzzle className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Extension navigateur fournisseur
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Importez un produit depuis Amazon, Shopify, Temu, Shein ou AliExpress (API) en un clic
            depuis la page source. Chargez l’extension, collez le jeton ci-dessous.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="ext-label">Nom du navigateur</Label>
          <Input
            id="ext-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Chrome, Firefox…"
            maxLength={80}
          />
        </div>
        <Button
          type="button"
          onClick={() => void createToken()}
          disabled={creating}
          className="bg-violet-600 hover:bg-violet-500"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden />
          )}
          Générer un jeton
        </Button>
      </div>

      {freshToken ? (
        <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
            Jeton (affiché une seule fois)
          </p>
          <p className="mt-2 break-all font-mono text-sm text-zinc-900 dark:text-zinc-100">
            {freshToken}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void copyToken()}>
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Copier
          </Button>
        </div>
      ) : null}

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Jetons actifs</p>
        {loading ? (
          <p className="mt-2 text-sm text-zinc-500">Chargement…</p>
        ) : tokens.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Aucun jeton — générez-en un pour connecter l’extension.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 dark:divide-zinc-800 dark:border-zinc-800">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{t.label}</p>
                  <p className="text-xs text-zinc-500">
                    Créé {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                    {t.lastUsedAt
                      ? ` · utilisé ${new Date(t.lastUsedAt).toLocaleDateString("fr-FR")}`
                      : null}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-zinc-500 hover:text-rose-600"
                  aria-label="Révoquer"
                  onClick={() => void revoke(t.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Extension : chargez le dossier{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
          apps/affisell-supplier-extension/dist
        </code>{" "}
        dans Chrome → Extensions → Mode développeur → Charger l’extension non empaquetée.
      </p>
    </Card>
  )
}
