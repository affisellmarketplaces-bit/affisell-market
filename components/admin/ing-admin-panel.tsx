"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Loader2, Play, RefreshCw, Wrench } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import type { IngAnalyzeResult, IngChatPlan, IngTask } from "@/lib/ai-engineer/types"
import { cn } from "@/lib/utils"

const TYPE_BADGE: Record<IngTask["type"], string> = {
  BUG: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  FEATURE: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  OPTIMIZATION: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
}

export function IngAdminPanel() {
  const [loading, setLoading] = useState(true)
  const [fixing, setFixing] = useState<string | null>(null)
  const [analyze, setAnalyze] = useState<IngAnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatReply, setChatReply] = useState<IngChatPlan | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ing/analyze", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as IngAnalyzeResult
      setAnalyze(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runFix(task: IngTask, dryRun: boolean) {
    setFixing(task.id)
    setError(null)
    try {
      const res = await fetch("/api/ing/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, autoFix: true, dryRun }),
      })
      const data = (await res.json()) as { error?: string; shipped?: { commit: string | null } }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      await load()
      if (data.shipped?.commit) {
        setChatReply({
          summary: "Auto-fix shipped",
          tasks: [task],
          actions: [],
          reply: `Commit ${data.shipped.commit}${dryRun ? " (dry-run)" : ""}`,
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
        body: JSON.stringify({ message }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const plan = (await res.json()) as IngChatPlan
      setChatReply(plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : "chat_failed")
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-10">
        <BentoPageHeading
          eyebrow="Admin · Ing"
          title="Affisell Ing"
          description="Senior humanoid engineer — observe logs, fix bugs, ship."
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Re-scan logs
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            onClick={() => void fixAll()}
            disabled={loading || fixing !== null}
          >
            <Wrench className="size-4" />
            Fix All
          </button>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <BentoCard className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bot className="size-4 text-violet-600" aria-hidden />
            {loading ? "Ing observe les logs…" : "Ing a terminé l'observation"}
          </div>
          {analyze ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {analyze.logLinesScanned} lignes · {analyze.tasks.length} task(s) · {analyze.observedAt}
            </p>
          ) : null}
        </BentoCard>

        <ul className="space-y-3">
          {(analyze?.tasks ?? []).length === 0 && !loading ? (
            <li className="text-sm text-muted-foreground">Aucun pattern détecté — tout semble OK.</li>
          ) : null}
          {(analyze?.tasks ?? []).map((task) => (
            <li key={task.id}>
              <BentoCard className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", TYPE_BADGE[task.type])}>
                        {task.type}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
                      {task.count != null ? (
                        <span className="text-xs text-muted-foreground">×{task.count}</span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium">{task.description}</p>
                    {task.logs.length > 0 ? (
                      <pre className="mt-2 max-h-24 overflow-auto rounded bg-zinc-950/5 p-2 text-[10px] dark:bg-zinc-950">
                        {task.logs.join("\n")}
                      </pre>
                    ) : null}
                  </div>
                  {task.autoFixable ? (
                    <button
                      type="button"
                      className={cn(buttonVariants({ size: "sm" }), "shrink-0 gap-1")}
                      disabled={fixing === task.id}
                      onClick={() => void runFix(task, false)}
                    >
                      {fixing === task.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      Auto-fix
                    </button>
                  ) : null}
                </div>
              </BentoCard>
            </li>
          ))}
        </ul>

        <BentoCard className="p-4 space-y-3">
          <p className="text-sm font-semibold">Chat Ing</p>
          <form onSubmit={(e) => void sendChat(e)} className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Ing, connecte tous les suppliers Woo…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button type="submit" className={buttonVariants({ size: "sm" })} disabled={chatLoading}>
              {chatLoading ? <Loader2 className="size-4 animate-spin" /> : "Ask"}
            </button>
          </form>
          {chatReply ? (
            <div className="rounded-lg bg-violet-50/80 p-3 text-sm dark:bg-violet-950/30">
              <p className="font-medium">{chatReply.summary}</p>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{chatReply.reply}</p>
            </div>
          ) : null}
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
