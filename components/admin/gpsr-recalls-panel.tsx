"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, PackageX } from "lucide-react"

import { BentoCard } from "@/components/affisell/bento-ui"
import {
  LEGAL_COCKPIT_CARD,
  LEGAL_COCKPIT_TEXT_MUTED,
  LEGAL_COCKPIT_TEXT_PRIMARY,
} from "@/components/admin/legal-cockpit-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RecallRow = {
  id: string
  productId: string
  reason: string
  riskLevel: string
  status: string
  notifiedCount: number
  createdAt: string
}

export function GpsrRecallsPanel() {
  const [recalls, setRecalls] = useState<RecallRow[]>([])
  const [productId, setProductId] = useState("")
  const [reason, setReason] = useState("")
  const [riskLevel, setRiskLevel] = useState<"faible" | "grave" | "critique">("grave")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [notifying, setNotifying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/legal/recall", { credentials: "include", cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; recalls?: RecallRow[] }
      if (data.ok) setRecalls(data.recalls ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createRecall() {
    if (!productId.trim() || reason.trim().length < 10) {
      setError("productId et motif (10+ car.) requis")
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: productId.trim(), reason: reason.trim(), riskLevel }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setProductId("")
      setReason("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "create_failed")
    } finally {
      setCreating(false)
    }
  }

  async function notifyRecall(id: string) {
    setNotifying(id)
    setError(null)
    try {
      const res = await fetch(`/api/legal/recall/${id}/notify`, {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; notifiedCount?: number }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "notify_failed")
    } finally {
      setNotifying(null)
    }
  }

  return (
    <BentoCard className={LEGAL_COCKPIT_CARD}>
      <div className="flex items-center gap-2">
        <PackageX className="size-4 text-red-400" aria-hidden />
        <p className={cn("text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>Rappels GPSR</p>
      </div>
      <p className={cn("mt-1 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>Règlement (UE) 2023/988 — blocage produit + notification acheteurs.</p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <input
          className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          placeholder="Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <select
          className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value as typeof riskLevel)}
        >
          <option value="faible">Risque faible</option>
          <option value="grave">Risque grave</option>
          <option value="critique">Risque critique</option>
        </select>
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm" }), "bg-red-800 hover:bg-red-700")}
          disabled={creating}
          onClick={() => void createRecall()}
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : "Créer rappel"}
        </button>
      </div>
      <textarea
        className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        rows={2}
        placeholder="Motif du rappel (défaut sécurité, non-conformité GPSR…)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-zinc-500" />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {recalls.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-3 py-2.5 text-sm">
              <div>
                <p className={LEGAL_COCKPIT_TEXT_PRIMARY}>{r.productId}</p>
                <p className={cn("text-[11px]", LEGAL_COCKPIT_TEXT_MUTED)}>
                  {r.riskLevel} · {r.status} · {r.notifiedCount} notifié(s)
                </p>
              </div>
              {r.status === "draft" ? (
                <button
                  type="button"
                  className={cn(buttonVariants({ size: "sm" }), "h-7 text-[10px]")}
                  disabled={notifying === r.id}
                  onClick={() => void notifyRecall(r.id)}
                >
                  {notifying === r.id ? <Loader2 className="size-3 animate-spin" /> : "Notifier"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  )
}
