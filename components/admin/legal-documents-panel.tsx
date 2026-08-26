"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Eye,
  FileText,
  Loader2,
  PenLine,
  ScrollText,
  Shield,
  Sparkles,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import {
  LegalDocumentPreviewModal,
  type LegalDocumentPreviewData,
} from "@/components/admin/legal-document-preview-modal"
import {
  LEGAL_COCKPIT_ATMOSPHERE_COMPACT,
  LEGAL_COCKPIT_CARD,
  LEGAL_COCKPIT_CTA,
  LEGAL_COCKPIT_HEADING,
  LEGAL_COCKPIT_ICON,
  LEGAL_COCKPIT_SHELL,
  LEGAL_COCKPIT_TABLE_HEAD,
  LEGAL_COCKPIT_TABLE_ROW,
  LEGAL_COCKPIT_TABLE_WRAP,
  LEGAL_COCKPIT_TEXT_MUTED,
  LEGAL_COCKPIT_TEXT_PRIMARY,
  legalDocStatusBadge,
  legalOutlineButtonClass,
} from "@/components/admin/legal-cockpit-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LegalDocRow = {
  id: string
  type: string
  title: string
  version: number
  status: string
  preview: string
  markdown?: string
  html?: string
}

type DocCard = {
  type: "cgv" | "cgu" | "mentions" | "contrat_fournisseur"
  label: string
  icon: typeof FileText
  fields: Array<{ key: string; label: string; type?: string; placeholder?: string }>
}

const DOC_CARDS: DocCard[] = [
  {
    type: "cgv",
    label: "CGV Marketplace",
    icon: ScrollText,
    fields: [
      { key: "companyName", label: "Nom société", placeholder: "Affisell" },
      { key: "marketplaceName", label: "Nom marketplace", placeholder: "Affisell Market" },
    ],
  },
  {
    type: "cgu",
    label: "CGU Utilisateurs",
    icon: Shield,
    fields: [],
  },
  {
    type: "mentions",
    label: "Mentions légales",
    icon: FileText,
    fields: [
      { key: "companyName", label: "Nom société" },
      { key: "siret", label: "SIRET" },
      { key: "adresse", label: "Adresse" },
    ],
  },
  {
    type: "contrat_fournisseur",
    label: "Contrat Fournisseur",
    icon: PenLine,
    fields: [
      { key: "supplierName", label: "Nom fournisseur" },
      { key: "commission", label: "Commission (%)", type: "number", placeholder: "10" },
      { key: "companyName", label: "Nom société" },
    ],
  },
]

function toPreviewData(doc: LegalDocRow & { markdown?: string; html?: string }): LegalDocumentPreviewData | null {
  const markdown = doc.markdown ?? doc.preview
  const html = doc.html
  if (!markdown || !html) return null
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    version: doc.version,
    status: doc.status,
    markdown,
    html,
  }
}

export function LegalDocumentsPanel() {
  const [defaults, setDefaults] = useState<Record<string, Record<string, string | number>>>({})
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({})
  const [documents, setDocuments] = useState<LegalDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<LegalDocumentPreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const [signEmail, setSignEmail] = useState("")
  const [signing, setSigning] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lastSignUrl, setLastSignUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/avocat/documents", { cache: "no-store", credentials: "include" })
      const data = (await res.json()) as {
        ok?: boolean
        defaults?: typeof defaults
        documents?: LegalDocRow[]
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setDefaults(data.defaults ?? {})
      setDocuments(data.documents ?? [])
      const initialForms: Record<string, Record<string, string>> = {}
      for (const card of DOC_CARDS) {
        const d = (data.defaults ?? {}) as Record<string, Record<string, string | number>>
        const src =
          card.type === "cgv"
            ? d.cgv
            : card.type === "mentions"
              ? d.mentions
              : card.type === "contrat_fournisseur"
                ? d.contrat
                : {}
        initialForms[card.type] = Object.fromEntries(
          card.fields.map((f) => [f.key, String(src?.[f.key] ?? "")])
        )
      }
      setForms(initialForms)
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function fetchAndOpenPreview(docId: string) {
    setPreviewLoading(docId)
    setError(null)
    try {
      const res = await fetch(`/api/legal/avocat/documents?id=${docId}`, { credentials: "include" })
      const json = (await res.json()) as {
        ok?: boolean
        document?: LegalDocRow & { markdown: string; html: string }
        error?: string
      }
      if (!res.ok || !json.ok || !json.document) throw new Error(json.error ?? "preview_failed")
      const data = toPreviewData(json.document)
      if (!data) throw new Error("preview_incomplete")
      setPreviewDoc(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "preview_failed")
    } finally {
      setPreviewLoading(null)
    }
  }

  async function generate(type: DocCard["type"]) {
    setGenerating(type)
    setError(null)
    try {
      const data = forms[type] ?? {}
      const payload =
        type === "contrat_fournisseur"
          ? { ...data, commission: Number(data.commission || 10) }
          : type === "cgu"
            ? {}
            : data
      const res = await fetch("/api/legal/avocat/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, data: payload }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        document?: LegalDocRow & { markdown: string; html: string }
        error?: string
      }
      if (!res.ok || !json.ok || !json.document) throw new Error(json.error ?? `HTTP ${res.status}`)
      const preview = toPreviewData(json.document)
      if (preview) setPreviewDoc(preview)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "generate_failed")
    } finally {
      setGenerating(null)
    }
  }

  async function publishFromPreview() {
    if (!previewDoc) return
    setPublishing(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/avocat/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: previewDoc.id, action: "publish" }),
      })
      if (!res.ok) throw new Error("publish_failed")
      await load()
      setPreviewDoc((prev) => (prev ? { ...prev, status: "published" } : null))
    } catch (e) {
      setError(e instanceof Error ? e.message : "publish_failed")
    } finally {
      setPublishing(false)
    }
  }

  async function requestSignFromPreview() {
    if (!previewDoc || !signEmail.trim()) {
      setError("Email signataire requis")
      return
    }
    setSigning(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentId: previewDoc.id,
          email: signEmail.trim(),
          signerName: forms.contrat_fournisseur?.supplierName,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; signingUrl?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setLastSignUrl(data.signingUrl ?? null)
      setPreviewDoc(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign_request_failed")
    } finally {
      setSigning(false)
    }
  }

  const docsByType = useMemo(() => {
    const map = new Map<string, LegalDocRow[]>()
    for (const d of documents) {
      const list = map.get(d.type) ?? []
      list.push(d)
      map.set(d.type, list)
    }
    return map
  }, [documents])

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <div className={LEGAL_COCKPIT_ATMOSPHERE_COMPACT} aria-hidden />
      <BentoShell className={cn("relative", LEGAL_COCKPIT_SHELL)}>
        <BentoContainer maxWidth="5xl" className="space-y-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BentoPageHeading
              className={LEGAL_COCKPIT_HEADING}
              eyebrow="Affisell · Conformité DSA"
              title="Documents légaux"
              description="Générez · prévisualisez le rendu A4 · publiez ou envoyez en signature — sans surprise."
            />
            <Link
              href="/dashboard/admin/legal"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), legalOutlineButtonClass())}
            >
              ← Avocat Numérique
            </Link>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>
          ) : null}

          {lastSignUrl ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              Lien signature :{" "}
              <a href={lastSignUrl} className="underline" target="_blank" rel="noreferrer">
                {lastSignUrl}
              </a>
            </p>
          ) : null}

          <ul className="grid gap-4 md:grid-cols-2">
            {DOC_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <li key={card.type}>
                  <BentoCard className={cn(LEGAL_COCKPIT_CARD, "h-full")}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("size-4", LEGAL_COCKPIT_ICON)} aria-hidden />
                      <p className={cn("font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>{card.label}</p>
                    </div>
                    {card.fields.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {card.fields.map((field) => (
                          <label key={field.key} className={cn("block text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
                            {field.label}
                            <input
                              className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                              type={field.type ?? "text"}
                              placeholder={field.placeholder}
                              value={forms[card.type]?.[field.key] ?? ""}
                              onChange={(e) =>
                                setForms((prev) => ({
                                  ...prev,
                                  [card.type]: { ...prev[card.type], [field.key]: e.target.value },
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className={cn("mt-2 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
                        Génération automatique depuis identité Affisell.
                      </p>
                    )}
                    <button
                      type="button"
                      className={cn(buttonVariants({ size: "sm" }), "mt-4 w-full", LEGAL_COCKPIT_CTA)}
                      disabled={generating === card.type}
                      onClick={() => void generate(card.type)}
                    >
                      {generating === card.type ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Générer & prévisualiser
                    </button>
                    {(docsByType.get(card.type) ?? []).slice(0, 2).map((doc) => (
                      <p key={doc.id} className={cn("mt-2 text-[10px]", LEGAL_COCKPIT_TEXT_MUTED)}>
                        v{doc.version} · {doc.status}
                      </p>
                    ))}
                  </BentoCard>
                </li>
              )
            })}
          </ul>

          <BentoCard className={LEGAL_COCKPIT_CARD}>
            <p className={cn("text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>Versions</p>
            <p className={cn("mt-1 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
              Prévisualisez toujours avant publication ou envoi signature électronique.
            </p>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-zinc-500" />
              </div>
            ) : (
              <div className={cn("mt-4", LEGAL_COCKPIT_TABLE_WRAP)}>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className={LEGAL_COCKPIT_TABLE_HEAD}>
                    <tr>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Version</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className={LEGAL_COCKPIT_TABLE_ROW}>
                        <td className="px-4 py-3.5">
                          <p className={cn("font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>{doc.title}</p>
                          <p className={cn("text-[11px]", LEGAL_COCKPIT_TEXT_MUTED)}>{doc.type}</p>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-zinc-300">{doc.version}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              legalDocStatusBadge(doc.status)
                            )}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "h-8 gap-1.5 text-[11px]",
                              legalOutlineButtonClass()
                            )}
                            disabled={previewLoading === doc.id}
                            onClick={() => void fetchAndOpenPreview(doc.id)}
                          >
                            {previewLoading === doc.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Eye className="size-3.5" aria-hidden />
                            )}
                            Prévisualiser
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BentoCard>
        </BentoContainer>
      </BentoShell>

      <LegalDocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
        signEmail={signEmail}
        onSignEmailChange={setSignEmail}
        signerName={forms.contrat_fournisseur?.supplierName}
        onPublish={previewDoc?.status === "draft" ? publishFromPreview : undefined}
        onRequestSign={
          previewDoc?.type === "contrat_fournisseur" && previewDoc.status === "published"
            ? requestSignFromPreview
            : undefined
        }
        publishing={publishing}
        signing={signing}
      />
    </div>
  )
}
