"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { UIMessage } from "ai"
import { BarChart3, LineChart, Sparkles, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  AffiliateAgentToolSearchPart,
  type AffiliateSearchSupplierToolPart,
} from "@/components/affiliate/affiliate-agent-tool-search"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function assistantHasRenderableContent(m: UIMessage): boolean {
  if (m.role !== "assistant") return false
  if (messageText(m).trim().length > 0) return true
  return m.parts.some((p) => p.type === "tool-searchSupplierCatalog")
}

const STARTER_PROMPTS = [
  "SKU marge élevée fitness < 50€",
  "Nouveautés tech commission > 20%",
  "Comparer leggings femme fournisseurs",
  "Tendance montres connectées à sourcer",
] as const

export function AffiliateAgentChat() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")
  const [lastQuery, setLastQuery] = useState<string | null>(null)
  const prefillDone = useRef(false)

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/affiliate/history", { credentials: "include" })
      if (!res.ok) return
      const data = (await res.json()) as { lastQuery?: string | null }
      setLastQuery(data.lastQuery ?? null)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (prefillDone.current || !lastQuery?.trim()) return
    setInput((cur) => {
      prefillDone.current = true
      return cur.trim() ? cur : lastQuery
    })
  }, [lastQuery])

  const { messages, sendMessage, status, error, stop, clearError } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent/affiliate",
    }),
    onFinish: () => {
      void loadHistory()
    },
  })

  const busy = status === "submitted" || status === "streaming"

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, status])

  async function sendFromInput() {
    const text = input.trim()
    if (!text || busy) return
    setInput("")
    clearError()
    await sendMessage({ text })
  }

  return (
    <div className="mx-auto w-full">
      <div className="relative h-[72vh] w-full overflow-hidden rounded-[2rem] border border-violet-200/40 shadow-2xl shadow-violet-900/10 dark:border-violet-900/50">
        <div className="absolute inset-0 bg-[#0c0a12]" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-3xl" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3 md:px-6">
            <div className="flex items-center gap-2 text-xs text-violet-200/90">
              <Sparkles className="h-4 w-4 text-violet-400" aria-hidden />
              <span className="font-semibold uppercase tracking-wider">Agent sourcing</span>
            </div>
            <Link
              href={AFFILIATE_CATALOG_PATH}
              className="rounded-full border border-violet-500/30 bg-violet-950/50 px-3 py-1 text-xs font-semibold text-violet-100 hover:bg-violet-900/50"
            >
              Ouvrir le catalogue →
            </Link>
          </div>

          <div ref={scrollRef} className="flex min-h-[360px] flex-1 flex-col gap-3 overflow-y-auto p-4 md:p-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-900/40">
                  <BarChart3 className="h-8 w-8 text-white" aria-hidden />
                </div>
                <h3 className="text-xl font-bold text-white sm:text-2xl">
                  Quels produits promouvoir cette semaine ?
                </h3>
                <p className="mt-2 max-w-md text-sm text-zinc-400">
                  Je compare commissions, marges estimées et fit niche — pour remplir votre vitrine avec les bons SKU.
                </p>
                <ul className="mt-6 grid w-full max-w-lg grid-cols-2 gap-2 text-left text-xs text-zinc-500">
                  <li className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                    <TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                    Best sellers &amp; marge
                  </li>
                  <li className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                    <LineChart className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
                    Analyse par niche
                  </li>
                </ul>
                <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setInput(q)}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 text-left text-sm text-zinc-200 transition hover:border-violet-500/40 hover:bg-violet-950/40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {busy && messages.length > 0 && messages[messages.length - 1]?.role === "user" ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-violet-950/60 px-4 py-3 text-sm text-violet-100">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-400" />
                    Analyse sourcing…
                  </span>
                </div>
              </div>
            ) : null}

            {messages.map((m) => {
              if (m.role === "user") {
                const text = messageText(m).trim()
                if (!text) return null
                return (
                  <div
                    key={m.id}
                    className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm text-white"
                  >
                    <p className="whitespace-pre-wrap break-words">{text}</p>
                  </div>
                )
              }

              if (!assistantHasRenderableContent(m)) return null

              return (
                <div
                  key={m.id}
                  className="mr-auto w-full max-w-[95%] rounded-2xl rounded-bl-sm border border-violet-500/15 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 backdrop-blur-md"
                >
                  {m.parts.map((part, idx) => {
                    if (part.type === "text" && "text" in part && part.text?.trim()) {
                      return (
                        <p key={`${m.id}-t-${idx}`} className="whitespace-pre-wrap break-words">
                          {part.text}
                        </p>
                      )
                    }
                    if (part.type === "tool-searchSupplierCatalog") {
                      const toolPart = part as unknown as AffiliateSearchSupplierToolPart
                      return (
                        <AffiliateAgentToolSearchPart
                          key={`${m.id}-${toolPart.toolCallId ?? idx}`}
                          part={toolPart}
                        />
                      )
                    }
                    return null
                  })}
                </div>
              )
            })}
          </div>

          {error ? (
            <div
              role="alert"
              className="mx-4 mb-2 rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200"
            >
              Une erreur est survenue. Réessayez.
              <button type="button" onClick={() => clearError()} className="ml-2 underline">
                Fermer
              </button>
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void sendFromInput()
            }}
            className="border-t border-white/5 bg-black/40 p-4"
          >
            <label className="sr-only" htmlFor="affiliate-agent-input">
              Question sourcing
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                id="affiliate-agent-input"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void sendFromInput()
                  }
                }}
                disabled={busy}
                placeholder="Ex. : niche fitness, marge > 15€, nouveautés fournisseur…"
                className={cn(
                  "min-h-[52px] flex-1 resize-y rounded-2xl border border-violet-500/20 bg-violet-950/30 px-4 py-3 text-sm text-white",
                  "placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                )}
              />
              <div className="flex shrink-0 gap-2">
                {busy ? (
                  <button
                    type="button"
                    onClick={() => void stop()}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-zinc-300"
                  >
                    Stop
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
                >
                  Analyser
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
