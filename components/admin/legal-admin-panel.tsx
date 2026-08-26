"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  FileText,
  Gavel,
  Loader2,
  Mail,
  Radar,
  Scale,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  FolderOpen,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { countAutoFixableScans, isAutoFixableProductScan } from "@/lib/legal/auto-fix"
import { LEGAL_MASTERS, type LegalAnalyzeType, type LegalMasterDomain } from "@/lib/legal/brain"
import type {
  LegalFixPreview,
  LegalIssue,
  LegalLetterSummary,
  LegalScanRow,
  LegalScanStats,
} from "@/lib/legal/scan-types"
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

type TabId = "doctrine" | "scans" | "documents"

type Props = {
  openAiConfigured: boolean
}

function riskBadgeClass(score: number): string {
  if (score >= 80) return "bg-red-500/20 text-red-200 ring-red-400/40"
  if (score >= 50) return "bg-amber-500/20 text-amber-200 ring-amber-400/40"
  if (score >= 25) return "bg-yellow-500/15 text-yellow-100 ring-yellow-400/30"
  return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
}

function primaryIssue(issues: LegalIssue[]): string {
  if (issues.length === 0) return "—"
  const order = ["critical", "high", "medium", "low"]
  const sorted = [...issues].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
  )
  return sorted[0]?.message ?? "—"
}

function typeLabel(type: string): string {
  if (type === "product") return "Produit"
  if (type === "supplier") return "Fournisseur"
  return type
}

export function LegalAdminPanel({ openAiConfigured }: Props) {
  const [tab, setTab] = useState<TabId>("doctrine")
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

  const [scans, setScans] = useState<LegalScanRow[]>([])
  const [scansLoading, setScansLoading] = useState(false)
  const [scanRunning, setScanRunning] = useState(false)
  const [lastScanStats, setLastScanStats] = useState<LegalScanStats | null>(null)
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)
  const [letters, setLetters] = useState<LegalLetterSummary[]>([])
  const [lettersLoading, setLettersLoading] = useState(false)
  const [fixModal, setFixModal] = useState<{
    scan: LegalScanRow
    preview: LegalFixPreview | null
    loading: boolean
    applying: boolean
  } | null>(null)
  const [letterModal, setLetterModal] = useState<{
    scan: LegalScanRow
    loading: boolean
    result: { letterId: string; letterMarkdown: string; viewUrl: string } | null
  } | null>(null)

  const autoFixableCount = useMemo(() => countAutoFixableScans(scans), [scans])

  useEffect(() => {
    setMounted(true)
    const id = window.setInterval(() => setPulse((p) => !p), 2000)
    return () => window.clearInterval(id)
  }, [])

  const loadScans = useCallback(async () => {
    setScansLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/scan", { cache: "no-store", credentials: "include" })
      if (res.status === 401 || res.status === 403) {
        throw new Error("Session admin requise — reconnectez-vous sur /login/admin")
      }
      const data = (await res.json()) as { ok?: boolean; scans?: LegalScanRow[]; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setScans(data.scans ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan_load_failed")
    } finally {
      setScansLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "scans") void loadScans()
  }, [tab, loadScans])

  const loadLetters = useCallback(async () => {
    setLettersLoading(true)
    try {
      const res = await fetch("/api/legal/letter", { cache: "no-store", credentials: "include" })
      const data = (await res.json()) as { ok?: boolean; letters?: LegalLetterSummary[] }
      if (res.ok && data.ok) setLetters(data.letters ?? [])
    } catch {
      /* non-blocking */
    } finally {
      setLettersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "scans") void loadLetters()
  }, [tab, loadLetters])

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

  async function runGuardianScan() {
    setScanRunning(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/scan", {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as {
        ok?: boolean
        stats?: LegalScanStats
        error?: string
      }
      if (!res.ok || !data.ok || !data.stats) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setLastScanStats(data.stats)
      await loadScans()
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan_run_failed")
    } finally {
      setScanRunning(false)
    }
  }

  async function patchScanStatus(id: string, status: "fixed" | "ignored") {
    setStatusUpdating(id)
    setError(null)
    try {
      const res = await fetch("/api/legal/scan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      await loadScans()
    } catch (e) {
      setError(e instanceof Error ? e.message : "status_patch_failed")
    } finally {
      setStatusUpdating(null)
    }
  }

  async function openFixModal(scan: LegalScanRow) {
    setFixModal({ scan, preview: null, loading: true, applying: false })
    setError(null)
    try {
      const res = await fetch("/api/legal/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scanId: scan.id }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        original?: LegalFixPreview["original"]
        fixed?: LegalFixPreview["fixed"]
        changes?: LegalFixPreview["changes"]
      }
      if (!res.ok || !data.ok || !data.original || !data.fixed || !data.changes) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setFixModal({
        scan,
        preview: {
          ok: true,
          original: data.original,
          fixed: data.fixed,
          changes: data.changes,
        },
        loading: false,
        applying: false,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "fix_preview_failed")
      setFixModal(null)
    }
  }

  async function applyFix(scanId: string) {
    setFixModal((prev) => (prev ? { ...prev, applying: true } : prev))
    setError(null)
    try {
      const res = await fetch("/api/legal/fix", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scanId, apply: true }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setFixModal(null)
      await loadScans()
    } catch (e) {
      setError(e instanceof Error ? e.message : "fix_apply_failed")
      setFixModal((prev) => (prev ? { ...prev, applying: false } : prev))
    }
  }

  async function openLetterModal(scan: LegalScanRow) {
    const supplierId = scan.supplierIdForLetter
    if (!supplierId) {
      setError("Fournisseur introuvable pour cette cible")
      return
    }
    setLetterModal({ scan, loading: true, result: null })
    setError(null)
    try {
      const res = await fetch("/api/legal/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplierId,
          scanId: scan.id,
          type: "mise_en_demeure",
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        letterId?: string
        letterMarkdown?: string
        viewUrl?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.letterId) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setLetterModal({
        scan,
        loading: false,
        result: {
          letterId: data.letterId,
          letterMarkdown: data.letterMarkdown ?? "",
          viewUrl: data.viewUrl ?? `/dashboard/admin/legal/lettre/${data.letterId}`,
        },
      })
      await loadLetters()
    } catch (e) {
      setError(e instanceof Error ? e.message : "letter_failed")
      setLetterModal(null)
    }
  }

  const statusLabel = useMemo(() => {
    if (!openAiConfigured) return "OPENAI_API_KEY absent"
    if (loading || scanRunning) return "Analyse en cours…"
    return tab === "scans" ? "Gardien actif" : "Doctrine live"
  }, [loading, openAiConfigured, scanRunning, tab])

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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: tab === "doctrine" ? "default" : "outline", size: "sm" }),
                tab === "doctrine" && "bg-amber-700 hover:bg-amber-600",
                tab !== "doctrine" && "border-zinc-700 bg-zinc-950/50"
              )}
              onClick={() => setTab("doctrine")}
            >
              <BookOpen className="mr-1.5 size-4" aria-hidden />
              Doctrine
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: tab === "scans" ? "default" : "outline", size: "sm" }),
                tab === "scans" && "bg-amber-700 hover:bg-amber-600",
                tab !== "scans" && "border-zinc-700 bg-zinc-950/50"
              )}
              onClick={() => setTab("scans")}
            >
              <Radar className="mr-1.5 size-4" aria-hidden />
              Scans
            </button>
            <Link
              href="/dashboard/admin/legal/documents"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5 border-zinc-700 bg-zinc-950/50"
              )}
            >
              <FolderOpen className="size-4" aria-hidden />
              Documents
            </Link>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {tab === "doctrine" ? (
            <>
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
                            <p className="font-mono text-2xl font-bold tabular-nums text-amber-300">
                              {score}
                            </p>
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
            </>
          ) : (
            <BentoCard className="border-amber-500/20 bg-zinc-950/90 p-5 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Gardien automatique</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Scan 50 produits + 50 fournisseurs · règles L121-1 + GPT-4o JSON · cron 08:00 UTC
                  </p>
                  {lastScanStats ? (
                    <p className="mt-2 text-xs text-amber-200/80">
                      Dernier scan — {lastScanStats.productsScanned} produits ·{" "}
                      {lastScanStats.suppliersScanned} fournisseurs · {lastScanStats.highRiskCount}{" "}
                      alerte(s) ≥70
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs font-medium text-emerald-300/90">
                    Auto-fixables : {autoFixableCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-zinc-700")}
                    onClick={() => void loadScans()}
                    disabled={scansLoading || scanRunning}
                  >
                    {scansLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Rafraîchir"
                    )}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "gap-1.5 bg-gradient-to-r from-amber-700 to-amber-600"
                    )}
                    disabled={scanRunning}
                    onClick={() => void runGuardianScan()}
                  >
                    {scanRunning ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Radar className="size-4" />
                    )}
                    Lancer Scan Maintenant
                  </button>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-black/40 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Cible</th>
                      <th className="px-3 py-2.5 font-medium">Score</th>
                      <th className="px-3 py-2.5 font-medium">Issue principale</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.length === 0 && !scansLoading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                          Aucun scan — lancez le Gardien pour auditer le catalogue.
                        </td>
                      </tr>
                    ) : null}
                    {scans.map((row) => (
                      <tr key={row.id} className="border-b border-zinc-800/80 last:border-0">
                        <td className="px-3 py-3">
                          <p className="font-medium text-zinc-100">{row.targetName}</p>
                          <p className="text-[10px] text-zinc-500">
                            {typeLabel(row.type)} · {row.targetId.slice(0, 10)}…
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 font-mono text-xs font-bold ring-1",
                              riskBadgeClass(row.riskScore)
                            )}
                          >
                            {row.riskScore}
                          </span>
                        </td>
                        <td className="max-w-xs px-3 py-3 text-xs leading-relaxed text-zinc-400">
                          {primaryIssue(row.issues)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs uppercase tracking-wide text-zinc-400">{row.status}</span>
                        </td>
                        <td className="px-3 py-3">
                          {row.status === "open" ? (
                            <div className="flex flex-wrap gap-1">
                              {isAutoFixableProductScan(row) ? (
                                <button
                                  type="button"
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "h-7 gap-1 px-2 text-[10px] border-amber-600/40 text-amber-200"
                                  )}
                                  onClick={() => void openFixModal(row)}
                                >
                                  <Wrench className="size-3" aria-hidden />
                                  Voir Fix
                                </button>
                              ) : null}
                              {row.supplierIdForLetter ? (
                                <button
                                  type="button"
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "h-7 gap-1 px-2 text-[10px]"
                                  )}
                                  disabled={letterModal?.loading === true}
                                  onClick={() => void openLetterModal(row)}
                                >
                                  <Mail className="size-3" aria-hidden />
                                  Générer Lettre
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-[10px]")}
                                disabled={statusUpdating === row.id}
                                onClick={() => void patchScanStatus(row.id, "ignored")}
                              >
                                Ignorer
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 border-t border-zinc-800 pt-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">Lettres générées</p>
                  {lettersLoading ? <Loader2 className="size-4 animate-spin text-zinc-500" /> : null}
                </div>
                {letters.length === 0 ? (
                  <p className="text-xs text-zinc-500">Aucune lettre — générez une mise en demeure depuis un scan.</p>
                ) : (
                  <ul className="space-y-2">
                    {letters.map((letter) => (
                      <li
                        key={letter.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-zinc-200">
                            {letter.type === "mise_en_demeure" ? "Mise en demeure" : "Avertissement"} ·{" "}
                            {letter.supplierName}
                          </p>
                          <p className="truncate text-[10px] text-zinc-500">{letter.preview}…</p>
                        </div>
                        <Link
                          href={letter.viewUrl}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 shrink-0 text-[10px]")}
                        >
                          Ouvrir / Imprimer
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </BentoCard>
          )}
        </BentoContainer>
      </BentoShell>

      {fixModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-amber-500/30 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-200">Auto-fix — {fixModal.scan.targetName}</p>
                <p className="text-xs text-zinc-500">Preview conforme L121-1 · non persisté tant que non appliqué</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                onClick={() => setFixModal(null)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {fixModal.loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-8 animate-spin text-amber-400" />
              </div>
            ) : fixModal.preview ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Original</p>
                  <pre className="max-h-64 overflow-auto rounded-xl border border-zinc-800 bg-black/50 p-3 text-xs text-zinc-400 whitespace-pre-wrap">
                    {fixModal.preview.original.title}
                    {"\n\n"}
                    {fixModal.preview.original.description.slice(0, 800)}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-emerald-500">Corrigé</p>
                  <pre className="max-h-64 overflow-auto rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-emerald-100/90 whitespace-pre-wrap">
                    {fixModal.preview.fixed.title}
                    {"\n\n"}
                    {fixModal.preview.fixed.description.slice(0, 800)}
                  </pre>
                </div>
                {fixModal.preview.changes.length > 0 ? (
                  <ul className="col-span-full space-y-1 text-xs text-zinc-400">
                    {fixModal.preview.changes.map((c, i) => (
                      <li key={`${c.field}-${i}`}>
                        <span className="text-amber-400">{c.field}</span> — {c.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="col-span-full flex justify-end gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    onClick={() => setFixModal(null)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className={cn(buttonVariants({ size: "sm" }), "bg-amber-700 hover:bg-amber-600")}
                    disabled={fixModal.applying}
                    onClick={() => void applyFix(fixModal.scan.id)}
                  >
                    {fixModal.applying ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Appliquer le fix"
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {letterModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-amber-500/30 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-amber-200">
                Mise en demeure — {letterModal.scan.targetName}
              </p>
              <button
                type="button"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                onClick={() => setLetterModal(null)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {letterModal.loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-8 animate-spin text-amber-400" />
              </div>
            ) : letterModal.result ? (
              <div className="mt-4">
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl border border-amber-500/20 bg-black/50 p-4 text-xs leading-relaxed text-amber-100/90">
                  {letterModal.result.letterMarkdown}
                </pre>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    onClick={() => setLetterModal(null)}
                  >
                    Fermer
                  </button>
                  <Link
                    href={letterModal.result.viewUrl}
                    className={cn(buttonVariants({ size: "sm" }), "bg-amber-700 hover:bg-amber-600")}
                  >
                    Imprimer / PDF
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
