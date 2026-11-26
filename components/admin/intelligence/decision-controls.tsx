"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { DECISION_LABELS, DECISIONS, type DecisionKind } from "@/lib/strategic-intelligence/journal"

const ERRORS: Record<string, string> = {
  signal_not_current: "Ce signal n’est plus levé : rechargez la page.",
  decision_already_open: "Une décision est déjà ouverte pour ce signal.",
  journal_unavailable: "Journal indisponible : la migration 20261117150000 n’est pas appliquée.",
  invalid_rationale: "Expliquez la décision (3 à 2000 caractères).",
  invalid_days: "Durée de mesure : entre 7 et 180 jours.",
  not_due: "Pas encore à échéance.",
  forbidden: "Réservé aux administrateurs.",
}

/** Records a decision on a signal. The server re-reads the signal and measures the baseline itself. */
export function DecisionForm({ signalId, measurable, defaultDays }: { signalId: string; measurable: boolean; defaultDays: number | null }) {
  const router = useRouter()
  const [decision, setDecision] = useState<DecisionKind>("act")
  const [rationale, setRationale] = useState("")
  const [days, setDays] = useState(String(defaultDays ?? 30))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/intelligence/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signalId, decision, rationale, measureAfterDays: measurable ? Number(days) : null }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(ERRORS[j.error ?? ""] ?? `Erreur (${res.status}).`)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-medium opacity-80">Consigner une décision</summary>
      <form onSubmit={submit} className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-3">
          {DECISIONS.map((d) => (
            <label key={d} className="flex items-center gap-1">
              <input type="radio" name={`decision-${signalId}`} checked={decision === d} onChange={() => setDecision(d)} />
              {DECISION_LABELS[d]}
            </label>
          ))}
        </div>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Pourquoi ? Ce que vous faites, ce que vous attendez."
          maxLength={2000}
          rows={2}
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        {measurable ? (
          <label className="flex items-center gap-2">
            Mesurer le résultat après
            <input
              type="number"
              min={7}
              max={180}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-16 rounded border border-zinc-300 bg-white px-1 py-0.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            jours (la situation actuelle est mesurée maintenant par le serveur)
          </label>
        ) : (
          <p className="opacity-70">Ce signal n’a pas d’indicateur mesurable automatiquement : la décision est consignée, sans mesure.</p>
        )}
        <button type="submit" disabled={busy} className="rounded bg-zinc-900 px-3 py-1 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {error ? <p className="text-red-700 dark:text-red-300">{error}</p> : null}
      </form>
    </details>
  )
}

export function MeasureButton({ decisionId }: { decisionId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/intelligence/decisions/${encodeURIComponent(decisionId)}/measure`, { method: "POST" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(ERRORS[j.error ?? ""] ?? `Erreur (${res.status}).`)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <span>
      <button type="button" onClick={run} disabled={busy} className="rounded border border-zinc-400 px-2 py-0.5 text-xs font-medium disabled:opacity-50">
        {busy ? "Mesure…" : "Mesurer maintenant"}
      </button>
      {error ? <span className="ml-2 text-xs text-red-700">{error}</span> : null}
    </span>
  )
}
