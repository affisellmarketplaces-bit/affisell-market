"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Fingerprint,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { KYC_REJECTION_PRESETS } from "@/lib/admin/merchant-kyc/rejection-presets"
import type {
  AdminKycDetail,
  AdminKycListItem,
  AdminKycQueueResponse,
  AdminKycStats,
} from "@/lib/admin/merchant-kyc/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "PENDING_REVIEW" | "NEEDS_MORE_INFO" | "REJECTED" | "APPROVED"

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "PENDING_REVIEW", label: "En attente" },
  { id: "NEEDS_MORE_INFO", label: "Compléments" },
  { id: "REJECTED", label: "Refusés" },
  { id: "APPROVED", label: "Validés" },
  { id: "all", label: "Tous" },
]

const STATUS_BADGE: Record<string, string> = {
  PENDING_REVIEW: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  NEEDS_MORE_INFO: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  REJECTED: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  APPROVED: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
}

const OFFICIAL_CHECKLIST = [
  "Pièce d'identité officielle (CNI, passeport, titre de séjour) — pas de capture d'écran",
  "Document lisible, non expiré, nom = dossier",
  "Kbis / SIRET < 3 mois si statut pro",
  "Pas de document généré ou modifié (Photoshop)",
] as const

type Props = {
  initial: AdminKycQueueResponse
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value}</p>
    </div>
  )
}

export function AdminKycConsole({ initial }: Props) {
  const [stats, setStats] = useState<AdminKycStats>(initial.stats)
  const [rows, setRows] = useState<AdminKycListItem[]>(initial.rows)
  const [filter, setFilter] = useState<StatusFilter>("PENDING_REVIEW")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initial.rows[0]?.userId ?? null)
  const [detail, setDetail] = useState<AdminKycDetail | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [checklist, setChecklist] = useState<boolean[]>(OFFICIAL_CHECKLIST.map(() => false))
  const [pending, startTransition] = useTransition()
  const [acting, setActing] = useState(false)

  const allChecked = useMemo(() => checklist.every(Boolean), [checklist])

  const loadQueue = useCallback(async (status: StatusFilter) => {
    const res = await fetch(`/api/admin/merchant-legal?status=${status}`, { credentials: "include" })
    const data = (await res.json()) as AdminKycQueueResponse & { error?: string }
    if (!res.ok) throw new Error(data.error ?? "load_failed")
    setStats(data.stats)
    setRows(data.rows)
    if (data.rows.length > 0 && !data.rows.some((r) => r.userId === selectedUserId)) {
      setSelectedUserId(data.rows[0]?.userId ?? null)
    }
  }, [selectedUserId])

  const loadDetail = useCallback(async (userId: string) => {
    const res = await fetch(`/api/admin/merchant-legal/${userId}`, { credentials: "include" })
    const data = (await res.json()) as { detail?: AdminKycDetail; error?: string }
    if (!res.ok) throw new Error(data.error ?? "detail_failed")
    setDetail(data.detail ?? null)
    setChecklist(OFFICIAL_CHECKLIST.map(() => false))
    setRejectionReason("")
  }, [])

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null)
      return
    }
    void loadDetail(selectedUserId).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Détail indisponible")
    )
  }, [selectedUserId, loadDetail])

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        await loadQueue(filter)
        if (selectedUserId) await loadDetail(selectedUserId)
        toast.success("File KYC actualisée")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur")
      }
    })
  }, [filter, loadQueue, loadDetail, selectedUserId])

  const changeFilter = useCallback(
    (next: StatusFilter) => {
      setFilter(next)
      startTransition(async () => {
        try {
          await loadQueue(next)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erreur")
        }
      })
    },
    [loadQueue]
  )

  const patchStatus = useCallback(
    async (status: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO") => {
      if (!selectedUserId) return
      if (status === "APPROVED" && !allChecked) {
        toast.error("Cochez toute la checklist documents officiels avant validation.")
        return
      }
      if ((status === "REJECTED" || status === "NEEDS_MORE_INFO") && !rejectionReason.trim()) {
        toast.error("Indiquez un motif de refus ou complément.")
        return
      }
      setActing(true)
      try {
        const res = await fetch(`/api/admin/merchant-legal/${selectedUserId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verificationStatus: status,
            rejectionReason: rejectionReason.trim() || undefined,
          }),
        })
        const body = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(body.error ?? "update_failed")
        toast.success(
          status === "APPROVED"
            ? "Dossier approuvé"
            : status === "REJECTED"
              ? "Dossier refusé"
              : "Compléments demandés"
        )
        await loadQueue(filter)
        const nextRow = rows.find((r) => r.userId !== selectedUserId && r.verificationStatus === filter)
        setSelectedUserId(nextRow?.userId ?? rows[0]?.userId ?? null)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action impossible")
      } finally {
        setActing(false)
      }
    },
    [selectedUserId, allChecked, rejectionReason, loadQueue, filter, rows]
  )

  const missingRequired = useMemo(() => {
    if (!detail) return []
    const uploaded = new Set(detail.documents.map((d) => d.documentType))
    return detail.requiredDocumentTypes.filter((t) => !uploaded.has(t))
  }, [detail])

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.2),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-400/90">
              <ShieldCheck className="size-3.5" aria-hidden />
              Trust Layer
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Vérification identité</h1>
            <p className="mt-1 max-w-xl text-sm text-violet-100/75">
              Dossiers fournisseurs & créateurs — pièces officielles uniquement. Aucune validation sans
              checklist.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={refresh}
            className="border-white/15 bg-white/5 text-violet-100 hover:bg-white/10"
          >
            <RefreshCw className={cn("mr-2 size-4", pending && "animate-spin")} aria-hidden />
            Actualiser
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="En attente" value={stats.pending} tone="text-amber-400" />
          <StatTile label="Compléments" value={stats.needsInfo} tone="text-sky-400" />
          <StatTile label="Refusés" value={stats.rejected} tone="text-rose-400" />
          <StatTile label="Validés" value={stats.approved} tone="text-emerald-400" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeFilter(tab.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                filter === tab.id
                  ? "border-violet-400/60 bg-violet-500/20 text-white"
                  : "border-white/10 bg-white/5 text-violet-200/80 hover:border-white/25"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <aside className="max-h-[calc(100dvh-16rem)] overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-xl">
            {rows.length === 0 ? (
              <p className="p-4 text-center text-sm text-violet-200/60">Aucun dossier dans cette file.</p>
            ) : (
              <ul className="space-y-1">
                {rows.map((row) => (
                  <li key={row.userId}>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(row.userId)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition",
                        selectedUserId === row.userId
                          ? "border-violet-400/50 bg-violet-500/15"
                          : "border-transparent hover:border-white/10 hover:bg-white/5"
                      )}
                    >
                      <p className="truncate text-sm font-semibold text-white">
                        {row.legalEntityName ?? row.name ?? row.email}
                      </p>
                      <p className="truncate text-[11px] text-violet-200/70">{row.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge className={cn("text-[9px]", STATUS_BADGE[row.verificationStatus])}>
                          {row.verificationStatus.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[10px] text-zinc-400">{row.role}</span>
                        <span className="text-[10px] text-zinc-500">{formatWhen(row.submittedAt)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[#1E1B4B]/80 via-[#312E81]/60 to-zinc-950/90 p-5 shadow-2xl shadow-violet-950/30 backdrop-blur-xl md:p-6">
            {!detail ? (
              <p className="text-sm text-violet-200/60">Sélectionnez un dossier dans la file.</p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {detail.legalEntityName ?? detail.name ?? "Sans nom"}
                    </h2>
                    <p className="text-sm text-violet-200/80">{detail.email}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {detail.legalStatus.replace(/_/g, " ")} · {detail.countryCode}
                      {detail.siret ? ` · SIRET ${detail.siret}` : ""}
                    </p>
                  </div>
                  <Badge className={cn(STATUS_BADGE[detail.verificationStatus])}>
                    {detail.verificationStatus.replace(/_/g, " ")}
                  </Badge>
                </div>

                {missingRequired.length > 0 ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                  >
                    <strong>Pièces manquantes :</strong> {missingRequired.join(", ")}
                  </div>
                ) : null}

                <div>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
                    Documents téléversés ({detail.documents.length})
                  </p>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {detail.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="overflow-hidden rounded-xl border border-white/15 bg-black/30"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                          <span className="flex items-center gap-2 text-xs font-semibold text-white">
                            {doc.documentType.startsWith("IDENTITY") ? (
                              <Fingerprint className="size-3.5 text-violet-300" aria-hidden />
                            ) : (
                              <FileText className="size-3.5 text-violet-300" aria-hidden />
                            )}
                            {doc.label}
                          </span>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-300 hover:text-white"
                            aria-label={`Ouvrir ${doc.label}`}
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        </div>
                        <div className="relative aspect-[4/3] bg-zinc-900">
                          {doc.isImage ? (
                            <img
                              src={doc.fileUrl}
                              alt={doc.label}
                              className="size-full object-contain"
                            />
                          ) : doc.isPdf ? (
                            <iframe
                              title={doc.label}
                              src={doc.fileUrl}
                              className="size-full border-0"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-xs text-zinc-500">
                              Aperçu indisponible — ouvrir le fichier
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
                    Checklist — documents officiels
                  </p>
                  <ul className="mt-3 space-y-2">
                    {OFFICIAL_CHECKLIST.map((item, i) => (
                      <li key={item}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-violet-100/90">
                          <input
                            type="checkbox"
                            checked={checklist[i]}
                            onChange={(e) =>
                              setChecklist((prev) => {
                                const next = [...prev]
                                next[i] = e.target.checked
                                return next
                              })
                            }
                            className="mt-0.5 rounded border-white/30 bg-transparent"
                          />
                          {item}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
                    Motif refus / compléments
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {KYC_REJECTION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setRejectionReason(preset.message)}
                        className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-violet-100 transition hover:border-violet-400/40 hover:bg-violet-500/15"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="Motif envoyé au marchand (visible sur /dashboard/verification)…"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
                  />
                </div>

                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <Button
                    type="button"
                    disabled={acting || detail.verificationStatus === "APPROVED"}
                    onClick={() => void patchStatus("APPROVED")}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="mr-2 size-4" aria-hidden />
                    Approuver
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={acting}
                    onClick={() => void patchStatus("NEEDS_MORE_INFO")}
                    className="border-sky-500/40 text-sky-100 hover:bg-sky-500/10"
                  >
                    <User className="mr-2 size-4" aria-hidden />
                    Demander compléments
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={acting}
                    onClick={() => void patchStatus("REJECTED")}
                  >
                    <XCircle className="mr-2 size-4" aria-hidden />
                    Refuser
                  </Button>
                  <a
                    href={`mailto:${detail.email}`}
                    className="ml-auto inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-white"
                  >
                    <Building2 className="size-3.5" aria-hidden />
                    Contacter
                  </a>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
