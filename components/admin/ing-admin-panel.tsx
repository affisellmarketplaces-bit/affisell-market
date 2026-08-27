"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  Cpu,
  Loader2,
  Play,
  Radar,
  RefreshCw,
  Sparkles,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import {
  ADMIN_COCKPIT_ATMOSPHERE,
  ADMIN_COCKPIT_CARD,
  ADMIN_COCKPIT_CARD_ACCENT,
  ADMIN_COCKPIT_HEADING,
  ADMIN_COCKPIT_SHELL,
  ADMIN_COCKPIT_TEXT_MUTED,
  ADMIN_COCKPIT_TEXT_SECONDARY,
} from "@/components/admin/admin-cockpit-ui"
import { buttonVariants } from "@/components/ui/button"
import type { IngAnalyzeResult, IngChatPlan, IngAction, IngTask } from "@/lib/ai-engineer/types"
import { formatIngObservedAt } from "@/lib/ai-engineer/format-observed-at"
import { cn } from "@/lib/utils"

const TYPE_STYLE: Record<
  IngTask["type"],
  { badge: string; glow: string; icon: typeof Zap }
> = {
  BUG: {
    badge: "bg-red-500/25 text-red-100 ring-red-400/45",
    glow: "shadow-[0_0_40px_-12px_rgba(239,68,68,0.45)]",
    icon: Zap,
  },
  BUG_CRITICAL: {
    badge: "bg-rose-600/30 text-rose-50 ring-rose-400/50",
    glow: "shadow-[0_0_48px_-10px_rgba(244,63,94,0.55)]",
    icon: Zap,
  },
  FEATURE: {
    badge: "bg-violet-500/25 text-violet-100 ring-violet-400/45",
    glow: "shadow-[0_0_40px_-12px_rgba(139,92,246,0.5)]",
    icon: Sparkles,
  },
  OPTIMIZATION: {
    badge: "bg-cyan-500/25 text-cyan-100 ring-cyan-400/45",
    glow: "shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)]",
    icon: Radar,
  },
}

type Props = {
  initialAnalyze?: IngAnalyzeResult | null
  bootstrapError?: string | null
}

export function IngAdminPanel({ initialAnalyze = null, bootstrapError = null }: Props) {
  const [loading, setLoading] = useState(!initialAnalyze)
  const [fixing, setFixing] = useState<string | null>(null)
  const [analyze, setAnalyze] = useState<IngAnalyzeResult | null>(initialAnalyze)
  const [error, setError] = useState<string | null>(bootstrapError)
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatReply, setChatReply] = useState<IngChatPlan | null>(null)
  const [pulse, setPulse] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const id = window.setInterval(() => setPulse((p) => !p), 1800)
    return () => window.clearInterval(id)
  }, [])

  const fixableCount = useMemo(
    () => (analyze?.tasks ?? []).filter((t) => t.autoFixable).length,
    [analyze?.tasks]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ing/analyze", { cache: "no-store", credentials: "include" })
      if (res.status === 401 || res.status === 403) {
        throw new Error("Admin session required — reconnect at /login/admin")
      }
      if (!res.ok) throw new Error(`Analyze HTTP ${res.status}`)
      const data = (await res.json()) as IngAnalyzeResult
      setAnalyze(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialAnalyze) void load()
  }, [initialAnalyze, load])

  async function runFix(task: IngTask, dryRun: boolean) {
    setFixing(task.id)
    setError(null)
    try {
      const res = await fetch("/api/ing/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taskId: task.id, autoFix: true, dryRun }),
      })
      const data = (await res.json()) as {
        error?: string
        shipped?: { commit: string | null; push: boolean }
        actions?: IngAction[]
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      await load()
      if (data.shipped?.commit) {
        setChatReply({
          summary: dryRun ? "Dry-run complete" : "Shipped by Ing",
          tasks: [task],
          actions: data.actions ?? [],
          reply: `Commit \`${data.shipped.commit}\`${data.shipped.push ? " · pushed" : ""}`,
        })
      } else if (data.actions?.length) {
        const opsLine = data.actions.map((a) => `${a.change}`).join(" · ")
        const manualNote =
          task.id === "manual_required_flood"
            ? "\n\nLe signal reste affiché tant que des FulfillmentGroups sont en manual_required (suppliers doivent connecter Shopify/Woo). Le nudge accélère la réponse, il ne vide pas la file."
            : ""
        setChatReply({
          summary: task.id === "manual_required_flood" ? "Supplier nudge exécuté" : "Fix Ing appliqué",
          tasks: [task],
          actions: data.actions,
          reply: `${opsLine}${manualNote}`,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "fix_failed")
    } finally {
      setFixing(null)
    }
  }

  async function fixAll() {
    const fixable = analyze?.tasks.filter((t) => t.autoFixable) ?? []
    if (fixable.length === 0) return
    setFixing("all")
    setError(null)
    try {
      for (const task of fixable) {
        await runFix(task, false)
      }
    } finally {
      setFixing(null)
    }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault()
    const message = chatInput.trim()
    if (!message) return
    setChatLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ing/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      })
      if (!res.ok) throw new Error(`Chat HTTP ${res.status}`)
      const plan = (await res.json()) as IngChatPlan
      setChatReply(plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : "chat_failed")
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <div className={ADMIN_COCKPIT_ATMOSPHERE} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(9,9,11,0.35))]"
        aria-hidden
      />

      <BentoShell tone="dark" className={cn("relative", ADMIN_COCKPIT_SHELL)}>
        <BentoContainer maxWidth="5xl" className="space-y-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BentoPageHeading
              className={ADMIN_COCKPIT_HEADING}
              tone="dark"
              eyebrow="Affisell · Humanoid Ops"
              title="Ing"
              description="Senior engineer — observes logs, patches code, ships fixes. Zero manual triage."
            />
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-100 backdrop-blur-md",
                mounted && pulse && "ring-2 ring-emerald-400/25"
              )}
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              {loading ? "Scanning…" : "Observer live"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5 border-zinc-600 bg-zinc-900/90 text-zinc-100 hover:border-violet-500/45 hover:bg-zinc-800 hover:text-white"
              )}
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Re-scan
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ size: "sm" }),
                "gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/40 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40"
              )}
              onClick={() => void fixAll()}
              disabled={loading || fixing !== null || fixableCount === 0}
              title={
                fixableCount === 0
                  ? "Aucune tâche auto-fixable — manual_required nécessite une action ops"
                  : `Exécuter ${fixableCount} fix(es) Ing`
              }
            >
              {fixing === "all" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wrench className="size-4" />
              )}
              Fix All {fixableCount > 0 ? `(${fixableCount})` : ""}
            </button>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm font-medium text-red-100">
              {error}
            </p>
          ) : null}

          <BentoCard className={cn(ADMIN_COCKPIT_CARD, "relative overflow-hidden")}>
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-500 shadow-lg shadow-violet-950/50">
                <Bot className="size-6 text-white" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">Log Eye</p>
                  <Cpu className="size-3.5 text-violet-300" aria-hidden />
                </div>
                <p className={cn("mt-1 text-sm", ADMIN_COCKPIT_TEXT_SECONDARY)}>
                  {loading
                    ? "Ing parse les logs dev + snapshot DB fulfillment…"
                    : analyze
                      ? `${analyze.logLinesScanned} lignes · ${analyze.tasks.length} signal(s) · ${formatIngObservedAt(analyze.observedAt)}`
                      : "En attente du premier scan"}
                </p>
              </div>
            </div>
          </BentoCard>

          <ul className="grid gap-4 md:grid-cols-2">
            {(analyze?.tasks ?? []).length === 0 && !loading ? (
              <li
                className={cn(
                  "col-span-full rounded-2xl border border-dashed border-zinc-600 p-8 text-center text-sm",
                  ADMIN_COCKPIT_TEXT_MUTED
                )}
              >
                Aucun pattern critique — stack saine. Ing reste en veille.
              </li>
            ) : null}
            {(analyze?.tasks ?? []).map((task) => {
              const style = TYPE_STYLE[task.type]
              const Icon = style.icon
              return (
                <li key={task.id}>
                  <BentoCard
                    className={cn(
                      ADMIN_COCKPIT_CARD,
                      "h-full transition hover:border-violet-500/45",
                      task.priority >= 80 && style.glow
                    )}
                  >
                    <div className="flex h-full flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1",
                              style.badge
                            )}
                          >
                            <Icon className="size-3" aria-hidden />
                            {task.type}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">{task.id}</span>
                          {task.count != null ? (
                            <span className="text-[10px] font-semibold text-zinc-300">×{task.count}</span>
                          ) : null}
                        </div>
                        <span className="text-[10px] tabular-nums text-zinc-400">P{task.priority}</span>
                      </div>
                      <p className={cn("flex-1 text-sm leading-relaxed", ADMIN_COCKPIT_TEXT_SECONDARY)}>
                        {task.description}
                      </p>
                      {task.logs.length > 0 ? (
                        <div className="rounded-lg border border-zinc-700 bg-zinc-950/80 p-2">
                          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400">
                            <Terminal className="size-3" aria-hidden />
                            Evidence
                          </div>
                          <pre className="max-h-20 overflow-auto font-mono text-[10px] leading-relaxed text-emerald-300">
                            {task.logs.join("\n")}
                          </pre>
                        </div>
                      ) : null}
                      {task.autoFixable ? (
                        <button
                          type="button"
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "mt-auto w-full gap-1 bg-violet-600 text-white hover:bg-violet-500"
                          )}
                          disabled={fixing === task.id || fixing === "all"}
                          onClick={() => void runFix(task, false)}
                        >
                          {fixing === task.id || fixing === "all" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Play className="size-4" />
                          )}
                          {task.id === "manual_required_flood"
                            ? "Run supplier nudge"
                            : "Auto-fix & ship"}
                        </button>
                      ) : (
                        <p className={cn("mt-auto text-[10px]", ADMIN_COCKPIT_TEXT_MUTED)}>
                          Manual — connect integrations in supplier hub
                        </p>
                      )}
                    </div>
                  </BentoCard>
                </li>
              )
            })}
          </ul>

          <BentoCard className={cn(ADMIN_COCKPIT_CARD, ADMIN_COCKPIT_CARD_ACCENT)}>
            <p className="text-sm font-semibold text-white">Command Ing</p>
            <p className={cn("mt-0.5 text-xs", ADMIN_COCKPIT_TEXT_MUTED)}>
              Natural language · context Affisell · last 50 logs
            </p>
            <form onSubmit={(e) => void sendChat(e)} className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-xl border border-zinc-600 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/35"
                placeholder="Ing, pourquoi manual_required sur 98 groups ?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button
                type="submit"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "shrink-0 bg-white px-5 text-zinc-900 hover:bg-zinc-100"
                )}
                disabled={chatLoading}
              >
                {chatLoading ? <Loader2 className="size-4 animate-spin" /> : "Ask"}
              </button>
            </form>
            {chatReply ? (
              <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-950/40 p-4">
                <p className="text-sm font-semibold text-violet-100">{chatReply.summary}</p>
                <p className={cn("mt-2 whitespace-pre-wrap text-sm leading-relaxed", ADMIN_COCKPIT_TEXT_SECONDARY)}>
                  {chatReply.reply}
                </p>
              </div>
            ) : null}
          </BentoCard>
        </BentoContainer>
      </BentoShell>
    </div>
  )
}
