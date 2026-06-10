"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Camera, CheckCircle2, Loader2, Play, XCircle } from "lucide-react"
import { toast } from "sonner"

import type { AgentMissionRow } from "@/lib/agents/load-agent-network"
import { UploadDropzone } from "@/lib/uploadthing"
import { cn } from "@/lib/utils"

const TYPE_LABELS: Record<string, string> = {
  QC_INSPECTION: "Contrôle qualité",
  COMPLIANCE_CHECK: "Conformité",
  PHOTO_PROOF: "Photo-preuve",
  REPACK_EXPRESS: "Relais express",
}

const STATUS_STYLE: Record<string, string> = {
  ASSIGNED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  IN_PROGRESS: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  PASSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
}

type Props = {
  missions: AgentMissionRow[]
  agentPaused: boolean
}

export function AgentMissionWorkspace({ missions, agentPaused }: Props) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { report: string; photos: string[] }>>({})
  const [, startTransition] = useTransition()

  const active = missions.filter((m) => ["ASSIGNED", "IN_PROGRESS"].includes(m.status))
  const done = missions.filter((m) => ["PASSED", "FAILED", "CANCELLED"].includes(m.status))

  function draftFor(id: string) {
    return drafts[id] ?? { report: "", photos: [] }
  }

  function setDraft(id: string, patch: Partial<{ report: string; photos: string[] }>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch } }))
  }

  async function submit(
    missionId: string,
    status: "IN_PROGRESS" | "PASSED" | "FAILED"
  ) {
    if (agentPaused) {
      toast.error("Votre compte est en pause — contactez Affisell.")
      return
    }
    setPendingId(missionId)
    const d = draftFor(missionId)
    try {
      const res = await fetch(`/api/agent/missions/${missionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status,
          ...(status !== "IN_PROGRESS"
            ? { reportSummary: d.report.trim(), photoUrls: d.photos }
            : {}),
        }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        toast.error(json?.error === "report_required" ? "Rédigez un résumé de rapport." : "Action impossible.")
        return
      }
      toast.success(status === "IN_PROGRESS" ? "Mission démarrée" : status === "PASSED" ? "Mission validée ✓" : "Rapport envoyé")
      startTransition(() => router.refresh())
    } catch {
      toast.error("Réseau indisponible — réessayez.")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-8">
      {agentPaused ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Compte en pause — vous ne pouvez pas traiter de nouvelles missions pour le moment.
        </div>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Missions actives ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Aucune mission assignée pour le moment.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {active.map((m) => (
              <li
                key={m.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <MissionHeader mission={m} />
                {m.instructions ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <b>Brief fournisseur :</b> {m.instructions}
                  </p>
                ) : null}

                {m.status === "ASSIGNED" ? (
                  <button
                    type="button"
                    disabled={pendingId === m.id || agentPaused}
                    onClick={() => void submit(m.id, "IN_PROGRESS")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {pendingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Démarrer la mission
                  </button>
                ) : null}

                {m.status === "IN_PROGRESS" ? (
                  <div className="mt-4 space-y-4">
                    <label className="block text-sm">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        Rapport d&apos;inspection *
                      </span>
                      <textarea
                        rows={4}
                        maxLength={4000}
                        value={draftFor(m.id).report}
                        onChange={(e) => setDraft(m.id, { report: e.target.value })}
                        placeholder="Défauts constatés, conformité, mesures, recommandation…"
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>

                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        <Camera className="h-4 w-4" aria-hidden />
                        Photos QC ({draftFor(m.id).photos.length}/12)
                      </p>
                      <div className="mt-2">
                        <UploadDropzone
                          endpoint="agentMissionProof"
                          onClientUploadComplete={(files) => {
                            const urls = files.map((f) => f.url)
                            setDraft(m.id, {
                              photos: [...draftFor(m.id).photos, ...urls].slice(0, 12),
                            })
                            toast.success(`${urls.length} photo(s) ajoutée(s)`)
                          }}
                          onUploadError={(err) => {
                            toast.error(err.message)
                          }}
                        />
                      </div>
                      {draftFor(m.id).photos.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {draftFor(m.id).photos.map((url) => (
                            <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border">
                              <Image src={url} alt="" fill className="object-cover" sizes="64px" />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pendingId === m.id || agentPaused}
                        onClick={() => void submit(m.id, "PASSED")}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Valider ✓
                      </button>
                      <button
                        type="button"
                        disabled={pendingId === m.id || agentPaused}
                        onClick={() => void submit(m.id, "FAILED")}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
                      >
                        <XCircle className="h-4 w-4" />
                        Échec (Quality Gate)
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Un échec coupe automatiquement l&apos;auto-buy du SKU pour protéger les clients.
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Historique</h2>
          <ul className="mt-3 space-y-2">
            {done.slice(0, 20).map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-zinc-100 px-4 py-3 dark:border-zinc-900"
              >
                <MissionHeader mission={m} compact />
                {m.reportSummary ? (
                  <p className="mt-1 text-xs italic text-zinc-500">« {m.reportSummary} »</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function MissionHeader({ mission: m, compact }: { mission: AgentMissionRow; compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[m.status])}>
        {m.status}
      </span>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {TYPE_LABELS[m.type] ?? m.type}
      </span>
      {!compact && m.productName ? (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">· {m.productName}</span>
      ) : null}
      {m.feeCents > 0 ? (
        <span className="text-xs text-zinc-500">{(m.feeCents / 100).toFixed(2)} €</span>
      ) : null}
    </div>
  )
}
