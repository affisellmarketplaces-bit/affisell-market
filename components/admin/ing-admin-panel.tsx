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
import { buttonVariants } from "@/components/ui/button"
import type { IngAnalyzeResult, IngChatPlan, IngTask } from "@/lib/ai-engineer/types"
import { formatIngObservedAt } from "@/lib/ai-engineer/format-observed-at"
import { cn } from "@/lib/utils"

const TYPE_STYLE: Record<
  IngTask["type"],
  { badge: string; glow: string; icon: typeof Zap }
> = {
  BUG: {
    badge: "bg-red-500/15 text-red-300 ring-red-400/30",
    glow: "shadow-[0_0_40px_-12px_rgba(239,68,68,0.45)]",
    icon: Zap,
  },
  BUG_CRITICAL: {
    badge: "bg-rose-600/20 text-rose-200 ring-rose-500/40",
    glow: "shadow-[0_0_48px_-10px_rgba(244,63,94,0.55)]",
    icon: Zap,
  },
  FEATURE: {
    badge: "bg-violet-500/15 text-violet-200 ring-violet-400/30",
    glow: "shadow-[0_0_40px_-12px_rgba(139,92,246,0.5)]",
    icon: Sparkles,
  },
  OPTIMIZATION: {
    badge: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30",
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
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      await load()
      if (data.shipped?.commit) {
        setChatReply({
          summary: dryRun ? "Dry-run complete" : "Shipped by Ing",
          tasks: [task],
          actions: [],
          reply: `Commit \`${data.shipped.commit}\`${data.shipped.push ? " · pushed" : ""}`,
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
    for (const task of fixable) {
      await runFix(task, false)
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
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.35),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 top-40 size-96 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 bottom-0 size-80 rounded-full bg-violet-600/10 blur-3xl"
        aria-hidden
      />

      <BentoShell className="relative">
        <BentoContainer maxWidth="5xl" className="space-y-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BentoPageHeading
              eyebrow="Affisell · Humanoid Ops"
              title="Ing"
              description="Senior engineer — observes logs, patches code, ships fixes. Zero manual triage."
            />
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-200 backdrop-blur-md",
                mounted && pulse && "ring-2 ring-violet-400/20"
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
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 border-violet-500/30 bg-violet-950/30")}
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
                "gap-1.5 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500"
              )}
              onClick={() => void fixAll()}
              disabled={loading || fixing !== null || fixableCount === 0}
            >
              <Wrench className="size-4" />
              Fix All {fixableCount > 0 ? `(${fixableCount})` : ""}
            </button>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <BentoCard className="relative overflow-hidden border-violet-500/20 bg-zinc-950/80 p-5 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-900/40">
                <Bot className="size-6 text-white" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">Log Eye</p>
                  <Cpu className="size-3.5 text-violet-400" aria-hidden />
                </div>
                <p className="mt-1 text-sm text-zinc-400">
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
              <li className="col-span-full rounded-2xl border border-dashed border-zinc-700/80 p-8 text-center text-sm text-zinc-500">
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
                      "h-full border-zinc-800/80 bg-zinc-950/70 p-4 backdrop-blur-sm transition hover:border-violet-500/40",
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
                          <span className="font-mono text-[10px] text-zinc-500">{task.id}</span>
                          {task.count != null ? (
                            <span className="text-[10px] font-semibold text-zinc-400">×{task.count}</span>
                          ) : null}
                        </div>
                        <span className="text-[10px] tabular-nums text-zinc-600">P{task.priority}</span>
                      </div>
                      <p className="flex-1 text-sm leading-relaxed text-zinc-200">{task.description}</p>
                      {task.logs.length > 0 ? (
                        <div className="rounded-lg border border-zinc-800 bg-black/60 p-2">
                          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-600">
                            <Terminal className="size-3" aria-hidden />
                            Evidence
                          </div>
                          <pre className="max-h-20 overflow-auto font-mono text-[10px] leading-relaxed text-emerald-400/90">
                            {task.logs.join("\n")}
                          </pre>
                        </div>
                      ) : null}
                      {task.autoFixable ? (
                        <button
                          type="button"
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "mt-auto w-full gap-1 bg-violet-700 hover:bg-violet-600"
                          )}
                          disabled={fixing === task.id}
                          onClick={() => void runFix(task, false)}
                        >
                          {fixing === task.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Play className="size-4" />
                          )}
                          Auto-fix & ship
                        </button>
                      ) : (
                        <p className="mt-auto text-[10px] text-zinc-600">Manual — connect integrations in supplier hub</p>
                      )}
                    </div>
                  </BentoCard>
                </li>
              )
            })}
          </ul>

          <BentoCard className="border-violet-500/20 bg-gradient-to-br from-zinc-950/90 to-violet-950/30 p-5 backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">Command Ing</p>
            <p className="mt-0.5 text-xs text-zinc-500">Natural language · context Affisell · last 50 logs</p>
            <form onSubmit={(e) => void sendChat(e)} className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-xl border border-zinc-700/80 bg-black/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                placeholder="Ing, pourquoi manual_required sur 98 groups ?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button
                type="submit"
                className={cn(buttonVariants({ size: "sm" }), "shrink-0 px-5")}
                disabled={chatLoading}
              >
                {chatLoading ? <Loader2 className="size-4 animate-spin" /> : "Ask"}
              </button>
            </form>
            {chatReply ? (
              <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-950/20 p-4">
                <p className="text-sm font-medium text-violet-200">{chatReply.summary}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{chatReply.reply}</p>
              </div>
            ) : null}
          </BentoCard>
        </BentoContainer>
      </BentoShell>
    </div>
  )
}
