"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { agentStatusLabelFr } from "@/lib/agents/agent-application-shared"

export type AdminAgentRow = {
  id: string
  displayName: string
  country: string
  city: string
  capabilities: string[]
  languages: string[]
  leadTimeHours: number
  contactEmail: string
  contactPhone: string | null
  applicationNote: string | null
  status: string
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  PAUSED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
}

export function AdminAgentApplications({
  pending,
  roster,
}: {
  pending: AdminAgentRow[]
  roster: AdminAgentRow[]
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function moderate(id: string, action: "activate" | "reject" | "pause" | "resume") {
    setError(null)
    setPendingId(id)
    try {
      const res = await fetch(`/api/admin/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = (await res.json().catch(() => null)) as {
        error?: string
        provision?: { loginUrl: string; created: boolean } | null
      } | null
      if (!res.ok) {
        setError(json?.error ?? `Erreur ${res.status}`)
        return
      }
      if (action === "activate" && json?.provision) {
        window.alert(
          json.provision.created
            ? "Agent activé — compte créé. L'agent définit son mot de passe via « Mot de passe oublié » sur /login/agent."
            : "Agent activé — compte lié. Connexion : /login/agent"
        )
      }
      startTransition(() => router.refresh())
    } catch {
      setError("Réseau indisponible — réessayez.")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Candidatures en attente ({pending.length})
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Les agents PENDING sont invisibles des fournisseurs. Activer les rend éligibles au matching
          auto ; refuser archive la candidature (l&apos;agent peut re-postuler).
        </p>
        <div className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-500">
              Aucune candidature — partagez{" "}
              <a href="/agents/apply" className="text-violet-700 underline dark:text-violet-300">
                /agents/apply
              </a>
            </p>
          ) : null}
          {pending.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              pendingId={pendingId}
              actions={[
                { action: "activate", label: "Activer", tone: "ok" as const },
                { action: "reject", label: "Refuser", tone: "danger" as const },
              ]}
              onAction={moderate}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Réseau actif / en pause ({roster.length})
        </h2>
        <div className="mt-4 space-y-3">
          {roster.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              pendingId={pendingId}
              actions={
                a.status === "ACTIVE"
                  ? [{ action: "pause", label: "Mettre en pause", tone: "default" as const }]
                  : a.status === "PAUSED"
                    ? [{ action: "resume", label: "Réactiver", tone: "ok" as const }]
                    : []
              }
              onAction={moderate}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function AgentCard({
  agent: a,
  pendingId,
  actions,
  onAction,
}: {
  agent: AdminAgentRow
  pendingId: string | null
  actions: { action: "activate" | "reject" | "pause" | "resume"; label: string; tone: "ok" | "danger" | "default" }[]
  onAction: (id: string, action: "activate" | "reject" | "pause" | "resume") => void
}) {
  return (
    <div className="rounded-xl border border-zinc-100 px-4 py-3 dark:border-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{a.displayName}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[a.status] ?? ""}`}
            >
              {agentStatusLabelFr(a.status)}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {a.city}, {a.country} · {a.contactEmail}
            {a.contactPhone ? ` · ${a.contactPhone}` : ""} · {a.leadTimeHours} h ·{" "}
            {a.capabilities.join(" · ")}
          </p>
          {a.applicationNote ? (
            <p className="mt-2 text-xs italic text-zinc-500">« {a.applicationNote} »</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {actions.map((btn) => (
            <button
              key={btn.action}
              type="button"
              disabled={pendingId === a.id}
              onClick={() => onAction(a.id, btn.action)}
              className={
                btn.tone === "ok"
                  ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  : btn.tone === "danger"
                    ? "rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
                    : "rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300"
              }
            >
              {pendingId === a.id ? "…" : btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
