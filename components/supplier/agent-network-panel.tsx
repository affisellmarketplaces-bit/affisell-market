"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlarmClock,
  BadgeCheck,
  Globe2,
  Loader2,
  Radar,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

import {
  AGENT_MISSION_TYPE_DEFS,
  type AgentMissionStatusValue,
  type AgentMissionTypeValue,
} from "@/lib/agents/agent-network-shared"
import { AgentMissionSupplierCard } from "@/components/supplier/agent-mission-supplier-card"
import type { AgentNetworkSnapshot } from "@/lib/agents/load-agent-network"
import { cn } from "@/lib/utils"

const TYPE_KEYS: Record<AgentMissionTypeValue, string> = {
  QC_INSPECTION: "typeQc",
  COMPLIANCE_CHECK: "typeCompliance",
  PHOTO_PROOF: "typePhoto",
  REPACK_EXPRESS: "typeExpress",
}

type MissionFilter = "all" | "active" | "done"

const ACTIVE_STATUSES: AgentMissionStatusValue[] = ["REQUESTED", "ASSIGNED", "IN_PROGRESS"]
const DONE_STATUSES: AgentMissionStatusValue[] = ["PASSED", "FAILED", "CANCELLED"]

function flag(country: string): string {
  const code = country.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return "🌐"
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100
  )
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold tabular-nums", accent ?? "text-white")}>{value}</p>
    </div>
  )
}

export function AgentNetworkPanel({ snapshot }: { snapshot: AgentNetworkSnapshot }) {
  const t = useTranslations("supplierDashboard.agentNetwork")
  const router = useRouter()
  const [productId, setProductId] = useState(snapshot.skus[0]?.productId ?? "")
  const [missionType, setMissionType] = useState<AgentMissionTypeValue>("QC_INSPECTION")
  const [instructions, setInstructions] = useState("")
  const [feeEur, setFeeEur] = useState(() => {
    const def = AGENT_MISSION_TYPE_DEFS.find((d) => d.type === "QC_INSPECTION")
    return def ? (def.listPriceCents / 100).toFixed(2) : "0"
  })
  const [urgent, setUrgent] = useState(false)
  const [deadlineLocal, setDeadlineLocal] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [missionFilter, setMissionFilter] = useState<MissionFilter>("all")
  const [, startTransition] = useTransition()

  const { agents, missions, skus, stats } = snapshot
  const selectedDef = AGENT_MISSION_TYPE_DEFS.find((d) => d.type === missionType)

  const filteredMissions = useMemo(() => {
    if (missionFilter === "active") {
      return missions.filter((m) => ACTIVE_STATUSES.includes(m.status))
    }
    if (missionFilter === "done") {
      return missions.filter((m) => DONE_STATUSES.includes(m.status))
    }
    return missions
  }, [missions, missionFilter])

  function syncFeeFromType(type: AgentMissionTypeValue) {
    const def = AGENT_MISSION_TYPE_DEFS.find((d) => d.type === type)
    if (def) setFeeEur((def.listPriceCents / 100).toFixed(2))
  }

  async function createMission(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/supplier/agent-missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: missionType,
          productId,
          ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
          feeCents: Math.round(Number(feeEur.replace(",", ".")) * 100) || 0,
          urgent,
          ...(deadlineLocal ? { deadlineAt: new Date(deadlineLocal).toISOString() } : {}),
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        deduped?: boolean
        agentName?: string | null
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "mission_failed")
      if (data.deduped) {
        toast.info(t("deduped"))
      } else if (data.agentName) {
        toast.success(t("createdWithAgent", { agent: data.agentName }))
      } else {
        toast.success(t("created"))
      }
      setInstructions("")
      startTransition(() => router.refresh())
    } catch {
      toast.error(t("error"))
    } finally {
      setSubmitting(false)
    }
  }

  const filterTabs: { id: MissionFilter; label: string; count: number }[] = [
    { id: "all", label: t("filterAll"), count: missions.length },
    {
      id: "active",
      label: t("filterActive"),
      count: missions.filter((m) => ACTIVE_STATUSES.includes(m.status)).length,
    },
    {
      id: "done",
      label: t("filterDone"),
      count: missions.filter((m) => DONE_STATUSES.includes(m.status)).length,
    },
  ]

  return (
    <section
      aria-labelledby="agent-network-heading"
      className="relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-zinc-950 text-white shadow-[0_0_60px_rgba(34,211,238,0.06)]"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.08),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden
      />

      <div className="relative border-b border-white/10 px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10">
                <Globe2 className="h-5 w-5 text-cyan-300" aria-hidden />
              </span>
              <h2 id="agent-network-heading" className="text-xl font-bold tracking-tight">
                {t("title")}
              </h2>
              <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200">
                {t("betaFree")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("subtitle")}</p>
            <p className="mt-2 text-xs text-cyan-200/70">
              {t("applyAgent")}{" "}
              <a href="/agents/apply" className="font-medium text-cyan-300 underline hover:text-white">
                {t("applyAgentLink")}
              </a>
            </p>
          </div>

          <div className="grid min-w-[220px] flex-1 grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-4">
            <StatTile label={t("statAgents")} value={stats.agentCount} accent="text-cyan-300" />
            <StatTile label={t("statCountries")} value={stats.countryCount} accent="text-cyan-300" />
            <StatTile label={t("statActive")} value={stats.activeMissions} />
            <StatTile label={t("statPassed")} value={stats.passedMissions} accent="text-emerald-300" />
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label={t("networkTitle")}>
          {agents.slice(0, 10).map((a) => (
            <span
              key={a.id}
              title={`${a.displayName} — ${a.city} · ${(a.ratingX10 / 10).toFixed(1)}★ · ${a.leadTimeHours} h`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm"
            >
              <span aria-hidden>{flag(a.country)}</span>
              <span className="font-medium">{a.city}</span>
              <span className="text-cyan-300">{(a.ratingX10 / 10).toFixed(1)}★</span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <form
          onSubmit={createMission}
          className="space-y-5 border-b border-white/10 px-5 py-6 sm:px-7 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden />
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              {t("requestTitle")}
            </h3>
          </div>

          {skus.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">{t("noSkus")}</p>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t("skuLabel")}
                </span>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-white shadow-inner focus:border-cyan-400/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                >
                  {skus.map((sku) => (
                    <option key={sku.productId} value={sku.productId}>
                      {sku.name}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t("typeLabel")}
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {AGENT_MISSION_TYPE_DEFS.map((def) => (
                    <button
                      key={def.type}
                      type="button"
                      onClick={() => {
                        setMissionType(def.type)
                        syncFeeFromType(def.type)
                      }}
                      aria-pressed={missionType === def.type}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left text-xs transition-all",
                        missionType === def.type
                          ? "border-cyan-400/70 bg-cyan-500/15 text-white shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.06]"
                      )}
                    >
                      <span className="block font-semibold">{t(TYPE_KEYS[def.type])}</span>
                      <span className="mt-1 block text-[11px] text-zinc-400">
                        {t("slaHours", { hours: def.slaHours })} ·{" "}
                        <s className="opacity-50">{eur(def.listPriceCents)}</s>{" "}
                        <span className="text-cyan-300">{t("free")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-3 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-950/50 via-zinc-950/90 to-violet-950/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-cyan-400" aria-hidden />
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                    {t("missionParams")}
                  </p>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-500">{t("missionParamsHint")}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-zinc-300">
                    {t("feeInput")}
                    <div className="relative mt-1.5">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                        €
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        step={0.01}
                        value={feeEur}
                        onChange={(e) => setFeeEur(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950/80 py-2.5 pl-8 pr-3 text-sm text-white focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                  </label>
                  <label className="block text-xs font-medium text-zinc-300">
                    {t("deadlineLabel")}
                    <div className="relative mt-1.5">
                      <AlarmClock
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400/80"
                        aria-hidden
                      />
                      <input
                        type="datetime-local"
                        value={deadlineLocal}
                        onChange={(e) => setDeadlineLocal(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950/80 py-2.5 pl-10 pr-2 text-sm text-white focus:border-cyan-400/60 focus:outline-none"
                      />
                    </div>
                  </label>
                </div>

                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-all",
                    urgent
                      ? "border-amber-400/50 bg-amber-500/10 shadow-[0_0_16px_rgba(251,191,36,0.1)]"
                      : "border-white/10 bg-black/20 hover:border-amber-400/30"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={urgent}
                    onChange={(e) => setUrgent(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-zinc-950 text-amber-400"
                  />
                  <Zap
                    className={cn("h-4 w-4 shrink-0", urgent ? "text-amber-300" : "text-zinc-500")}
                    aria-hidden
                  />
                  <span className="text-xs">
                    <span className="font-semibold text-zinc-100">{t("urgentLabel")}</span>
                    <span className="mt-0.5 block text-[10px] text-zinc-500">{t("urgentHint")}</span>
                  </span>
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t("instructionsLabel")}
                </span>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={t("instructionsPlaceholder")}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-cyan-400/60 focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || !productId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-4 py-3 text-sm font-bold text-zinc-950 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:from-cyan-300 hover:to-cyan-400 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                )}
                {submitting ? t("submitting") : t("submit")}
              </button>

              {selectedDef ? (
                <p className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400/80" aria-hidden />
                  {t("qualityGateHint")}
                </p>
              ) : null}
            </>
          )}
        </form>

        <div className="px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              {t("missionsTitle")}
            </h3>
            <div className="flex rounded-xl border border-white/10 bg-black/30 p-0.5">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMissionFilter(tab.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                    missionFilter === tab.id
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {tab.label}
                  <span className="ml-1 tabular-nums opacity-70">({tab.count})</span>
                </button>
              ))}
            </div>
          </div>

          {filteredMissions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
                <Radar className="h-6 w-6 text-cyan-400/80" aria-hidden />
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-300">
                {missions.length === 0 ? t("missionsEmpty") : t("missionsFilterEmpty")}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
                {t("missionsEmptyHint")}
              </p>
              <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2 text-[10px] text-zinc-600">
                <span className="rounded-full border border-white/10 px-2 py-1">{t("edit")}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{t("cancel")}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{t("end")}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{t("delete")}</span>
              </div>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {filteredMissions.slice(0, 12).map((m) => (
                <AgentMissionSupplierCard
                  key={m.id}
                  mission={m}
                  statusLabel={(status) => t(`status_${status}`)}
                  typeLabel={(type) => t(TYPE_KEYS[type])}
                  autoBuyPausedLabel={t("autoBuyPaused")}
                  formatPhotosLabel={(count) => t("photosCount", { count })}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
