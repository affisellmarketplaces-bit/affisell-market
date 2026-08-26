"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  FileText,
  Gavel,
  Loader2,
  Scale,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { LEGAL_MASTERS, type LegalAnalyzeType, type LegalMasterDomain } from "@/lib/legal/brain"
import { cn } from "@/lib/utils"

const MASTER_ICON: Record<LegalMasterDomain, typeof Scale> = {
  contract: FileText,
  risk: ShieldAlert,
  compliance: Scale,
  litigation: Gavel,
}

const MASTER_GLOW: Record<LegalMasterDomain, string> = {
  contract: "shadow-[0_0_40px_-12px_rgba(251,191,36,0.35)]",
  risk: "shadow-[0_0_40px_-12px_rgba(239,68,68,0.35)]",
  compliance: "shadow-[0_0_40px_-12px_rgba(34,211,238,0.3)]",
  litigation: "shadow-[0_0_40px_-12px_rgba(168,85,247,0.35)]",
}

type Props = {
  openAiConfigured: boolean
}

export function LegalAdminPanel({ openAiConfigured }: Props) {
  const [doctrineQuestion, setDoctrineQuestion] = useState("")
  const [contractContent, setContractContent] = useState("")
  const [contractQuestion, setContractQuestion] = useState("")
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState<LegalAnalyzeType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastType, setLastType] = useState<LegalAnalyzeType | null>(null)
  const [mounted, setMounted] = useState(false)
  const [pulse, setPulse] = useState(false)
  const [domainScores, setDomainScores] = useState<Record<LegalMasterDomain, number>>(() =>
    Object.fromEntries(LEGAL_MASTERS.map((m) => [m.id, m.baselineScore])) as Record<
      LegalMasterDomain,
      number
    >
  )

  useEffect(() => {
    setMounted(true)
    const id = window.setInterval(() => setPulse((p) => !p), 2000)
    return () => window.clearInterval(id)
  }, [])

  const runAnalyze = useCallback(
    async (type: LegalAnalyzeType, payload: { content?: string; question?: string }) => {
      setLoading(type)
      setError(null)
      try {
        const res = await fetch("/api/legal/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type, ...payload }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          analysis?: string
          error?: string
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error("Session admin requise — reconnectez-vous sur /login/admin")
        }
        if (data.error === "openai_key_missing") {
          throw new Error("OPENAI_API_KEY manquant — ajoutez la clé dans .env.local")
        }
        if (!res.ok || !data.ok || !data.analysis) {
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        setAnalysis(data.analysis)
        setLastType(type)
        if (type !== "doctrine") {
          setDomainScores((prev) => ({
            ...prev,
            [type]: Math.min(99, (prev[type as LegalMasterDomain] ?? 70) + 2),
          }))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "analyze_failed")
      } finally {
        setLoading(null)
      }
    },
    []
  )

  const statusLabel = useMemo(() => {
    if (!openAiConfigured) return "OPENAI_API_KEY absent"
    if (loading) return "Analyse en cours…"
    return "Doctrine live"
  }, [loading, openAiConfigured])

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(180,83,9,0.28),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 top-40 size-96 rounded-full bg-amber-600/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 bottom-0 size-80 rounded-full bg-zinc-700/20 blur-3xl"
        aria-hidden
      />

      <BentoShell className="relative">
        <BentoContainer maxWidth="5xl" className="space-y-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BentoPageHeading
              eyebrow="Affisell · Cabinet numérique"
              title="AFFISELL AVOCAT NUMÉRIQUE"
              description="Droit plateformes · L121-1 · L441-1 · RGPD art. 6 · DSA · Cass. com. 2023 — aide à la décision fondateur."
            />
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-100 backdrop-blur-md",
                mounted && pulse && openAiConfigured && "ring-2 ring-amber-400/20"
              )}
            >
              <span className="relative flex size-2">
                {openAiConfigured ? (
                  <>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
                  </>
                ) : (
                  <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                )}
              </span>
              {statusLabel}
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LEGAL_MASTERS.map((master) => {
              const Icon = MASTER_ICON[master.id]
              const score = domainScores[master.id]
              return (
                <li key={master.id}>
                  <BentoCard
                    className={cn(
                      "h-full border-zinc-800/80 bg-zinc-950/75 p-4 backdrop-blur-sm transition hover:border-amber-500/35",
                      score >= 85 && MASTER_GLOW[master.id]
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 shadow-lg shadow-amber-950/50">
                        <Icon className="size-5 text-amber-100" aria-hidden />
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-2xl font-bold tabular-nums text-amber-300">{score}</p>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">/100</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white">Maître · {master.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{master.subtitle}</p>
                  </BentoCard>
                </li>
              )
            })}
          </ul>

          <div className="grid gap-6 lg:grid-cols-2">
            <BentoCard className="border-amber-500/20 bg-gradient-to-br from-zinc-950/90 to-amber-950/20 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-amber-400" aria-hidden />
                <p className="text-sm font-semibold text-white">Chat Doctrine</p>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Question juridique · références L121-1, RGPD art. 6, DSA
              </p>
              <textarea
                className="mt-4 min-h-[140px] w-full resize-y rounded-xl border border-zinc-700/80 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="Ex. : Affisell est-elle vendeur ou intermédiaire si le supplier expédie depuis la Chine ?"
                value={doctrineQuestion}
                onChange={(e) => setDoctrineQuestion(e.target.value)}
              />
              <button
                type="button"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-3 w-full gap-1.5 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500"
                )}
                disabled={!doctrineQuestion.trim() || loading !== null || !openAiConfigured}
                onClick={() =>
                  void runAnalyze("doctrine", { question: doctrineQuestion.trim() })
                }
              >
                {loading === "doctrine" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Interroger la doctrine
              </button>
            </BentoCard>

            <BentoCard className="border-amber-500/20 bg-gradient-to-br from-zinc-950/90 to-zinc-900/80 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-amber-400" aria-hidden />
                <p className="text-sm font-semibold text-white">Analyse Contrat</p>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Collez CGU, CGV, DPA ou clause partenaire — audit clause par clause
              </p>
              <textarea
                className="mt-4 min-h-[100px] w-full resize-y rounded-xl border border-zinc-700/80 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="Coller le texte contractuel ici…"
                value={contractContent}
                onChange={(e) => setContractContent(e.target.value)}
              />
              <input
                className="mt-2 w-full rounded-xl border border-zinc-700/80 bg-black/50 px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="Question optionnelle (ex. clause limitative de responsabilité)"
                value={contractQuestion}
                onChange={(e) => setContractQuestion(e.target.value)}
              />
              <button
                type="button"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-3 w-full gap-1.5 bg-gradient-to-r from-zinc-700 to-amber-800 hover:from-zinc-600 hover:to-amber-700"
                )}
                disabled={!contractContent.trim() || loading !== null || !openAiConfigured}
                onClick={() =>
                  void runAnalyze("contract", {
                    content: contractContent.trim(),
                    question: contractQuestion.trim() || undefined,
                  })
                }
              >
                {loading === "contract" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Gavel className="size-4" />
                )}
                Auditer le contrat
              </button>
            </BentoCard>
          </div>

          {(analysis || loading) && (
            <BentoCard className="border-amber-500/25 bg-zinc-950/90 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-200">
                  {loading ? "Analyse en cours…" : "Résultat"}
                  {lastType && !loading ? (
                    <span className="ml-2 font-mono text-[10px] font-normal uppercase text-zinc-500">
                      {lastType}
                    </span>
                  ) : null}
                </p>
                {loading ? <Loader2 className="size-4 animate-spin text-amber-400" /> : null}
              </div>
              {analysis ? (
                <pre className="mt-4 max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-xl border border-amber-500/20 bg-black/60 p-4 font-mono text-xs leading-relaxed text-amber-200/95">
                  {analysis}
                </pre>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">GPT-4o structure la réponse…</p>
              )}
            </BentoCard>
          )}
        </BentoContainer>
      </BentoShell>
    </div>
  )
}
