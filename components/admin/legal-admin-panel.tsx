"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  FileText,
  Gavel,
  Loader2,
  Mail,
  Printer,
  Radar,
  Scale,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  FolderOpen,
  ShieldCheck,
  AlertTriangle,
  PackageX,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { DsaReportsPanel } from "@/components/admin/dsa-reports-panel"
import { GpsrRecallsPanel } from "@/components/admin/gpsr-recalls-panel"
import { KycPanel } from "@/components/admin/kyc-panel"
import { LegalPreviewFrame, printLegalHtml } from "@/components/admin/legal-preview-frame"
import {
  LEGAL_COCKPIT_CARD,
  LEGAL_COCKPIT_CARD_ACCENT,
  LEGAL_COCKPIT_HEADING,
  LEGAL_COCKPIT_SHELL,
  LEGAL_COCKPIT_TAB_ACTIVE,
  LEGAL_COCKPIT_TAB_IDLE,
  LEGAL_COCKPIT_TABLE_HEAD,
  LEGAL_COCKPIT_TABLE_ROW,
  LEGAL_COCKPIT_TABLE_WRAP,
  LEGAL_COCKPIT_TEXT_MUTED,
  LEGAL_COCKPIT_TEXT_PRIMARY,
  LEGAL_COCKPIT_TEXT_SECONDARY,
  LEGAL_COCKPIT_TEXT_SUBTLE,
  legalOutlineButtonClass,
  legalScanStatusBadge,
} from "@/components/admin/legal-cockpit-ui"
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

type TabId = "doctrine" | "scans" | "documents" | "dsa" | "kyc" | "recalls"

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
    result: { letterId: string; letterMarkdown: string; letterHtml: string; viewUrl: string } | null
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
        letterHtml?: string
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
          letterHtml: data.letterHtml ?? "",
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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(245,158,11,0.18),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(120,53,15,0.12),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(9,9,11,0.4))]"
        aria-hidden
      />

      <BentoShell className={cn("relative", LEGAL_COCKPIT_SHELL)}>
        <BentoContainer maxWidth="5xl" className="space-y-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BentoPageHeading
              className={LEGAL_COCKPIT_HEADING}
              eyebrow="Affisell · Cabinet numérique"
              title="AFFISELL AVOCAT NUMÉRIQUE"
              description="Droit plateformes · L121-1 · L441-1 · RGPD art. 6 · DSA · Cass. com. 2023 — aide à la décision fondateur."
            />
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/60 px-3 py-1.5 text-xs font-semibold text-amber-50 shadow-lg shadow-amber-950/40 backdrop-blur-md",
                mounted && pulse && openAiConfigured && "ring-2 ring-amber-400/30"
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
                tab === "doctrine" ? LEGAL_COCKPIT_TAB_ACTIVE : LEGAL_COCKPIT_TAB_IDLE
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
                tab === "scans" ? LEGAL_COCKPIT_TAB_ACTIVE : LEGAL_COCKPIT_TAB_IDLE
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
                "gap-1.5",
                LEGAL_COCKPIT_TAB_IDLE
              )}
            >
              <FolderOpen className="size-4" aria-hidden />
              Documents
            </Link>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: tab === "dsa" ? "default" : "outline", size: "sm" }),
                tab === "dsa" ? LEGAL_COCKPIT_TAB_ACTIVE : LEGAL_COCKPIT_TAB_IDLE
              )}
              onClick={() => setTab("dsa")}
            >
              <AlertTriangle className="mr-1.5 size-4" aria-hidden />
              Signalements DSA
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: tab === "kyc" ? "default" : "outline", size: "sm" }),
                tab === "kyc" ? LEGAL_COCKPIT_TAB_ACTIVE : LEGAL_COCKPIT_TAB_IDLE
              )}
              onClick={() => setTab("kyc")}
            >
              <ShieldCheck className="mr-1.5 size-4" aria-hidden />
              KYC
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: tab === "recalls" ? "default" : "outline", size: "sm" }),
                tab === "recalls" ? LEGAL_COCKPIT_TAB_ACTIVE : LEGAL_COCKPIT_TAB_IDLE
              )}
              onClick={() => setTab("recalls")}
            >
              <PackageX className="mr-1.5 size-4" aria-hidden />
              Rappels GPSR
            </button>
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
                          LEGAL_COCKPIT_CARD,
                          "h-full p-4 transition hover:border-amber-500/40",
                          score >= 85 && MASTER_GLOW[master.id]
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-900 shadow-lg shadow-amber-950/50">
                            <Icon className="size-5 text-amber-50" aria-hidden />
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-2xl font-bold tabular-nums text-amber-300">
                              {score}
                            </p>
                            <p className={cn("text-[10px] uppercase tracking-wider", LEGAL_COCKPIT_TEXT_MUTED)}>/100</p>
                          </div>
                        </div>
                        <p className={cn("mt-3 text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>
                          Maître · {master.label}
                        </p>
                        <p className={cn("mt-1 text-xs leading-relaxed", LEGAL_COCKPIT_TEXT_MUTED)}>{master.subtitle}</p>
                      </BentoCard>
                    </li>
                  )
                })}
              </ul>

              <div className="grid gap-6 lg:grid-cols-2">
                <BentoCard className={cn(LEGAL_COCKPIT_CARD, LEGAL_COCKPIT_CARD_ACCENT)}>
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-amber-400" aria-hidden />
                    <p className={cn("text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>Chat Doctrine</p>
                  </div>
                  <p className={cn("mt-0.5 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
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

                <BentoCard className={cn(LEGAL_COCKPIT_CARD, "border-zinc-700/90")}>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-amber-400" aria-hidden />
                    <p className={cn("text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>Analyse Contrat</p>
                  </div>
                  <p className={cn("mt-0.5 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
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
                <BentoCard className={cn(LEGAL_COCKPIT_CARD, LEGAL_COCKPIT_CARD_ACCENT)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-amber-200">
                      {loading ? "Analyse en cours…" : "Résultat"}
                      {lastType && !loading ? (
                        <span className={cn("ml-2 font-mono text-[10px] font-normal uppercase", LEGAL_COCKPIT_TEXT_MUTED)}>
                          {lastType}
                        </span>
                      ) : null}
                    </p>
                    {loading ? <Loader2 className="size-4 animate-spin text-amber-400" /> : null}
                  </div>
                  {analysis ? (
                    <pre className="mt-4 max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-xl border border-amber-500/30 bg-zinc-950/90 p-4 font-mono text-xs leading-relaxed text-amber-100/95">
                      {analysis}
                    </pre>
                  ) : (
                    <p className={cn("mt-4 text-sm", LEGAL_COCKPIT_TEXT_MUTED)}>GPT-4o structure la réponse…</p>
                  )}
                </BentoCard>
              )}
            </>
          ) : null}

          {tab === "scans" ? (
            <BentoCard className={cn(LEGAL_COCKPIT_CARD, LEGAL_COCKPIT_CARD_ACCENT)}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={cn("text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>Gardien automatique</p>
                  <p className={cn("mt-0.5 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
                    Scan 50 produits + 50 fournisseurs · règles L121-1 + GPT-4o JSON · cron 08:00 UTC
                  </p>
                  {lastScanStats ? (
                    <p className="mt-2 text-xs font-medium text-amber-200/95">
                      Dernier scan — {lastScanStats.productsScanned} produits ·{" "}
                      {lastScanStats.suppliersScanned} fournisseurs · {lastScanStats.highRiskCount}{" "}
                      alerte(s) ≥70
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs font-semibold text-emerald-300">
                    Auto-fixables : {autoFixableCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), legalOutlineButtonClass())}
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

              <div className={cn("mt-5", LEGAL_COCKPIT_TABLE_WRAP)}>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className={LEGAL_COCKPIT_TABLE_HEAD}>
                    <tr>
                      <th className="px-4 py-3">Cible</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Issue principale</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.length === 0 && !scansLoading ? (
                      <tr>
                        <td colSpan={5} className={cn("px-4 py-10 text-center", LEGAL_COCKPIT_TEXT_MUTED)}>
                          Aucun scan — lancez le Gardien pour auditer le catalogue.
                        </td>
                      </tr>
                    ) : null}
                    {scans.map((row) => (
                      <tr key={row.id} className={LEGAL_COCKPIT_TABLE_ROW}>
                        <td className="px-4 py-3.5">
                          <p className={cn("font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>{row.targetName}</p>
                          <p className={cn("text-[11px]", LEGAL_COCKPIT_TEXT_MUTED)}>
                            {typeLabel(row.type)} · {row.targetId.slice(0, 10)}…
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ring-1",
                              riskBadgeClass(row.riskScore)
                            )}
                          >
                            {row.riskScore}
                          </span>
                        </td>
                        <td className={cn("max-w-sm px-4 py-3.5 text-sm leading-relaxed", LEGAL_COCKPIT_TEXT_SECONDARY)}>
                          {primaryIssue(row.issues)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              legalScanStatusBadge(row.status)
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {row.status === "open" ? (
                            <div className="flex flex-wrap gap-1.5">
                              {isAutoFixableProductScan(row) ? (
                                <button
                                  type="button"
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "h-8 gap-1 border-amber-500/50 bg-amber-950/40 px-2.5 text-[11px] font-medium text-amber-100 hover:bg-amber-900/60"
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
                                    "h-8 gap-1 px-2.5 text-[11px] font-medium",
                                    legalOutlineButtonClass()
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
                                className={cn(
                                  buttonVariants({ variant: "ghost", size: "sm" }),
                                  "h-8 px-2.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                )}
                                disabled={statusUpdating === row.id}
                                onClick={() => void patchScanStatus(row.id, "ignored")}
                              >
                                Ignorer
                              </button>
                            </div>
                          ) : (
                            <span className={LEGAL_COCKPIT_TEXT_SUBTLE}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 border-t border-zinc-700/80 pt-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className={cn("text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>Lettres générées</p>
                  {lettersLoading ? <Loader2 className="size-4 animate-spin text-zinc-400" /> : null}
                </div>
                {letters.length === 0 ? (
                  <p className={cn("text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
                    Aucune lettre — générez une mise en demeure depuis un scan.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {letters.map((letter) => (
                      <li
                        key={letter.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className={cn("truncate text-xs font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>
                            {letter.type === "mise_en_demeure" ? "Mise en demeure" : "Avertissement"} ·{" "}
                            {letter.supplierName}
                          </p>
                          <p className={cn("truncate text-[11px]", LEGAL_COCKPIT_TEXT_MUTED)}>{letter.preview}…</p>
                        </div>
                        <Link
                          href={letter.viewUrl}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-8 shrink-0 text-[11px]",
                            legalOutlineButtonClass()
                          )}
                        >
                          Ouvrir / Imprimer
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </BentoCard>
          ) : null}

          {tab === "dsa" ? <DsaReportsPanel /> : null}
          {tab === "kyc" ? <KycPanel /> : null}
          {tab === "recalls" ? <GpsrRecallsPanel /> : null}
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
        <div
          className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/80 p-0 backdrop-blur-md sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-none border border-amber-500/30 bg-zinc-950 shadow-2xl sm:rounded-2xl sm:max-h-[92vh]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/90">
                  Prévisualisation · Mise en demeure
                </p>
                <p className={cn("mt-1 text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>
                  {letterModal.scan.targetName}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                onClick={() => setLetterModal(null)}
                aria-label="Fermer"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {letterModal.loading ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-amber-400" />
              </div>
            ) : letterModal.result ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                  <LegalPreviewFrame
                    title={`Mise en demeure — ${letterModal.scan.targetName}`}
                    markdown={letterModal.result.letterMarkdown}
                    html={letterModal.result.letterHtml}
                    frameMinHeight="min-h-[min(55vh,600px)]"
                  />
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-800 px-4 py-4 sm:px-6">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), legalOutlineButtonClass())}
                    onClick={() => setLetterModal(null)}
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), legalOutlineButtonClass())}
                    onClick={() =>
                      printLegalHtml(
                        letterModal.result!.letterHtml,
                        `Mise en demeure — ${letterModal.scan.targetName}`
                      )
                    }
                  >
                    <Printer className="mr-1.5 size-4" aria-hidden />
                    Imprimer / PDF
                  </button>
                  <Link
                    href={letterModal.result.viewUrl}
                    className={cn(buttonVariants({ size: "sm" }), "bg-amber-700 hover:bg-amber-600")}
                  >
                    Ouvrir page dédiée
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
