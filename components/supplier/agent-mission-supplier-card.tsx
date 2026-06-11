"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  AlarmClock,
  ChevronDown,
  Images,
  Loader2,
  Pencil,
  Square,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

import {
  canSupplierCancelMission,
  canSupplierDeleteMission,
  canSupplierEditMission,
  type AgentMissionTypeValue,
} from "@/lib/agents/agent-network-shared"
import type { AgentMissionRow } from "@/lib/agents/load-agent-network"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "border-amber-400/40 bg-amber-500/20 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.15)]",
  ASSIGNED: "border-sky-400/40 bg-sky-500/20 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.15)]",
  IN_PROGRESS: "border-violet-400/40 bg-violet-500/20 text-violet-200 shadow-[0_0_14px_rgba(167,139,250,0.2)]",
  PASSED: "border-emerald-400/40 bg-emerald-500/20 text-emerald-200",
  FAILED: "border-red-400/40 bg-red-500/20 text-red-200",
  CANCELLED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
}

type Props = {
  mission: AgentMissionRow
  statusLabel: (status: string) => string
  typeLabel: (type: AgentMissionTypeValue) => string
  autoBuyPausedLabel: string
  formatPhotosLabel: (count: number) => string
}

function flag(country: string): string {
  const code = country.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return "🌐"
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100
  )
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function deadlineCountdown(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / (60 * 60 * 1000))
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (h > 48) return `${Math.floor(h / 24)}j`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function AgentMissionSupplierCard({
  mission: m,
  statusLabel,
  typeLabel,
  autoBuyPausedLabel,
  formatPhotosLabel,
}: Props) {
  const t = useTranslations("supplierDashboard.agentNetwork")
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [reportOpen, setReportOpen] = useState(
    m.status === "PASSED" || m.status === "FAILED" || m.photoUrls.length > 0
  )
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [feeEur, setFeeEur] = useState((m.feeCents / 100).toFixed(2))
  const [instructions, setInstructions] = useState(m.instructions ?? "")
  const [urgent, setUrgent] = useState(m.urgent)
  const [deadlineLocal, setDeadlineLocal] = useState(toDatetimeLocalValue(m.deadlineAt))

  const hasReport = Boolean(m.reportSummary?.trim()) || m.photoUrls.length > 0
  const editable = canSupplierEditMission(m.status)
  const cancellable = canSupplierCancelMission(m.status)
  const deletable = canSupplierDeleteMission(m.status)
  const canEnd = m.status === "IN_PROGRESS" || m.status === "ASSIGNED"
  const countdown = deadlineCountdown(m.deadlineAt)

  async function runAction(
    action: "cancel" | "end" | "delete" | "save",
    body?: Record<string, unknown>
  ) {
    setBusy(action)
    try {
      if (action === "delete") {
        const res = await fetch(`/api/supplier/agent-missions/${m.id}`, {
          method: "DELETE",
          credentials: "include",
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error ?? "delete_failed")
        toast.success(t("deleted"))
      } else {
        const res = await fetch(`/api/supplier/agent-missions/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            action === "save"
              ? {
                  ...body,
                  feeCents: Math.round(Number(feeEur.replace(",", ".")) * 100),
                  instructions: instructions.trim() || null,
                  urgent,
                  deadlineAt: deadlineLocal ? new Date(deadlineLocal).toISOString() : null,
                }
              : { action }
          ),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error ?? "action_failed")
        if (action === "cancel") toast.success(t("cancelled"))
        else if (action === "end") toast.success(t("ended"))
        else toast.success(t("updated"))
        setEditOpen(false)
      }
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("actionError"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-3.5 py-3 backdrop-blur-sm transition-all hover:border-cyan-400/25",
        m.urgent && "ring-1 ring-amber-400/30"
      )}
    >
      {m.urgent ? (
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl"
          aria-hidden
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
              STATUS_STYLES[m.status] ?? ""
            )}
          >
            {statusLabel(m.status)}
          </span>
          <span className="text-xs font-medium text-zinc-100">{typeLabel(m.type)}</span>
          {m.urgent ? (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
              <Zap className="h-3 w-3" aria-hidden />
              {t("urgentBadge")}
            </span>
          ) : null}
          {m.autoBuyPaused ? (
            <span className="rounded-full border border-red-400/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300">
              {autoBuyPausedLabel}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {editable ? (
            <button
              type="button"
              title={t("edit")}
              disabled={busy !== null}
              onClick={() => setEditOpen((v) => !v)}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">{t("edit")}</span>
            </button>
          ) : null}
          {cancellable && m.status !== "IN_PROGRESS" ? (
            <button
              type="button"
              title={t("cancel")}
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm(t("cancelConfirm"))) void runAction("cancel")
              }}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-300 transition hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-200"
            >
              {busy === "cancel" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <XCircle className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="sr-only">{t("cancel")}</span>
            </button>
          ) : null}
          {canEnd ? (
            <button
              type="button"
              title={t("end")}
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm(t("endConfirm"))) void runAction("end")
              }}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-200"
            >
              {busy === "end" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Square className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="sr-only">{t("end")}</span>
            </button>
          ) : null}
          {deletable ? (
            <button
              type="button"
              title={t("delete")}
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm(t("deleteConfirm"))) void runAction("delete")
              }}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
            >
              {busy === "delete" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="sr-only">{t("delete")}</span>
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-1.5 truncate text-xs text-zinc-400">
        {m.productName ?? "—"}
        {m.agentName ? (
          <>
            {" · "}
            <span aria-hidden>{flag(m.agentCountry ?? "")}</span> {m.agentName} ({m.agentCity})
          </>
        ) : null}
      </p>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-0.5">
          {t("feeLabel")} <strong className="text-cyan-200">{eur(m.feeCents)}</strong>
        </span>
        {m.deadlineAt ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/20 px-2 py-0.5">
            <AlarmClock className="h-3 w-3 text-cyan-300" aria-hidden />
            {new Date(m.deadlineAt).toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            {countdown ? (
              <span className="font-semibold text-amber-300">· {countdown}</span>
            ) : null}
          </span>
        ) : null}
      </div>

      {editOpen ? (
        <div className="mt-3 space-y-3 rounded-lg border border-cyan-400/20 bg-cyan-950/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-300/80">
            {t("editPanel")}
          </p>
          <label className="block text-xs text-zinc-300">
            {t("feeInput")}
            <input
              type="number"
              min={0}
              max={500}
              step={0.01}
              value={feeEur}
              onChange={(e) => setFeeEur(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>
          <label className="block text-xs text-zinc-300">
            {t("instructionsLabel")}
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>
          <label className="block text-xs text-zinc-300">
            {t("deadlineLabel")}
            <input
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="rounded border-white/20 bg-zinc-950 text-amber-400 focus:ring-amber-400"
            />
            <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            {t("urgentLabel")}
          </label>
          <button
            type="button"
            disabled={busy === "save"}
            onClick={() => void runAction("save")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500/90 py-2 text-xs font-semibold text-zinc-950 hover:bg-cyan-400"
          >
            {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t("saveChanges")}
          </button>
        </div>
      ) : null}

      {hasReport ? (
        <>
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-cyan-300 hover:underline"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition", reportOpen && "rotate-180")} />
            {m.photoUrls.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Images className="h-3.5 w-3.5" />
                {formatPhotosLabel(m.photoUrls.length)}
              </span>
            ) : (
              t("viewReport")
            )}
          </button>
          {reportOpen ? (
            <div className="mt-2 space-y-2">
              {m.reportSummary ? (
                <p className="rounded-lg bg-black/25 px-3 py-2 text-xs italic text-zinc-200">
                  « {m.reportSummary} »
                </p>
              ) : null}
              {m.photoUrls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {m.photoUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block h-20 w-20 overflow-hidden rounded-lg border border-white/10"
                    >
                      <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : m.instructions && !editOpen ? (
        <p className="mt-2 line-clamp-2 text-xs text-zinc-400">« {m.instructions} »</p>
      ) : null}
    </li>
  )
}
