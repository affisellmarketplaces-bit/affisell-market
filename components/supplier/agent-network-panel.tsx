"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Globe2, Loader2, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

import {
  AGENT_MISSION_TYPE_DEFS,
  type AgentMissionTypeValue,
} from "@/lib/agents/agent-network-shared"
import type { AgentNetworkSnapshot } from "@/lib/agents/load-agent-network"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "border-amber-400/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ASSIGNED: "border-sky-400/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  IN_PROGRESS: "border-violet-400/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  PASSED: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FAILED: "border-red-400/30 bg-red-500/15 text-red-700 dark:text-red-300",
  CANCELLED: "border-zinc-400/30 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
}

const TYPE_KEYS: Record<AgentMissionTypeValue, string> = {
  QC_INSPECTION: "typeQc",
  COMPLIANCE_CHECK: "typeCompliance",
  PHOTO_PROOF: "typePhoto",
  REPACK_EXPRESS: "typeExpress",
}

/** Drapeau emoji depuis un code ISO-2 (CN → 🇨🇳). */
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

export function AgentNetworkPanel({ snapshot }: { snapshot: AgentNetworkSnapshot }) {
  const t = useTranslations("supplierDashboard.agentNetwork")
  const router = useRouter()
  const [productId, setProductId] = useState(snapshot.skus[0]?.productId ?? "")
  const [missionType, setMissionType] = useState<AgentMissionTypeValue>("QC_INSPECTION")
  const [instructions, setInstructions] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  const { agents, missions, skus, stats } = snapshot
  const selectedDef = AGENT_MISSION_TYPE_DEFS.find((d) => d.type === missionType)

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

  return (
    <section
      aria-labelledby="agent-network-heading"
      className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-zinc-950 via-cyan-950/70 to-zinc-900 text-white"
    >
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-cyan-300" aria-hidden />
              <h2 id="agent-network-heading" className="text-lg font-semibold">
                {t("title")}
              </h2>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                {t("betaFree")}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-zinc-300">{t("subtitle")}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-right sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-400">
                {t("statAgents")}
              </dt>
              <dd className="text-lg font-semibold text-cyan-300">{stats.agentCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-400">
                {t("statCountries")}
              </dt>
              <dd className="text-lg font-semibold text-cyan-300">{stats.countryCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-400">
                {t("statActive")}
              </dt>
              <dd className="text-lg font-semibold">{stats.activeMissions}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-400">
                {t("statPassed")}
              </dt>
              <dd className="text-lg font-semibold text-emerald-300">{stats.passedMissions}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label={t("networkTitle")}>
          {agents.slice(0, 8).map((a) => (
            <span
              key={a.id}
              title={`${a.displayName} — ${a.city} · ${(a.ratingX10 / 10).toFixed(1)}★ · ${a.leadTimeHours} h`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-200"
            >
              <span aria-hidden>{flag(a.country)}</span>
              {a.city}
              <span className="text-cyan-300">{(a.ratingX10 / 10).toFixed(1)}★</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_1.2fr]">
        <form
          onSubmit={createMission}
          className="space-y-4 border-b border-white/10 px-5 py-5 sm:px-6 lg:border-b-0 lg:border-r"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden />
            {t("requestTitle")}
          </h3>

          {skus.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("noSkus")}</p>
          ) : (
            <>
              <label className="block text-xs font-medium text-zinc-300">
                {t("skuLabel")}
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  {skus.map((sku) => (
                    <option key={sku.productId} value={sku.productId}>
                      {sku.name}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend className="text-xs font-medium text-zinc-300">{t("typeLabel")}</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {AGENT_MISSION_TYPE_DEFS.map((def) => (
                    <button
                      key={def.type}
                      type="button"
                      onClick={() => setMissionType(def.type)}
                      aria-pressed={missionType === def.type}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                        missionType === def.type
                          ? "border-cyan-400/60 bg-cyan-500/15 text-white"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/25"
                      )}
                    >
                      <span className="block font-semibold">{t(TYPE_KEYS[def.type])}</span>
                      <span className="mt-0.5 block text-[11px] text-zinc-400">
                        {t("slaHours", { hours: def.slaHours })} ·{" "}
                        <s className="opacity-60">{eur(def.listPriceCents)}</s>{" "}
                        <span className="text-cyan-300">{t("free")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block text-xs font-medium text-zinc-300">
                {t("instructionsLabel")}
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder={t("instructionsPlaceholder")}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || !productId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                )}
                {submitting ? t("submitting") : t("submit")}
              </button>

              {selectedDef ? (
                <p className="flex items-start gap-2 text-[11px] text-zinc-400">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
                  {t("qualityGateHint")}
                </p>
              ) : null}
            </>
          )}
        </form>

        <div className="px-5 py-5 sm:px-6">
          <h3 className="text-sm font-semibold">{t("missionsTitle")}</h3>
          {missions.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">{t("missionsEmpty")}</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {missions.slice(0, 6).map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        STATUS_STYLES[m.status] ?? ""
                      )}
                    >
                      {t(`status_${m.status}`)}
                    </span>
                    <span className="text-xs font-medium text-zinc-100">
                      {t(TYPE_KEYS[m.type])}
                    </span>
                    {m.autoBuyPaused ? (
                      <span className="rounded-full border border-red-400/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300">
                        {t("autoBuyPaused")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-400">
                    {m.productName ?? "—"}
                    {m.agentName ? (
                      <>
                        {" · "}
                        <span aria-hidden>{flag(m.agentCountry ?? "")}</span> {m.agentName} (
                        {m.agentCity})
                      </>
                    ) : null}
                  </p>
                  {m.reportSummary ? (
                    <p className="mt-1 text-xs italic text-zinc-300">« {m.reportSummary} »</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
