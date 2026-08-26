"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  FileText,
  Loader2,
  PenLine,
  ScrollText,
  Shield,
  Sparkles,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import {
  LEGAL_COCKPIT_CARD,
  LEGAL_COCKPIT_HEADING,
  LEGAL_COCKPIT_SHELL,
  LEGAL_COCKPIT_TABLE_HEAD,
  LEGAL_COCKPIT_TABLE_ROW,
  LEGAL_COCKPIT_TABLE_WRAP,
  LEGAL_COCKPIT_TEXT_MUTED,
  LEGAL_COCKPIT_TEXT_PRIMARY,
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

export function LegalDocumentsPanel() {
  const [defaults, setDefaults] = useState<Record<string, Record<string, string | number>>>({})
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({})
  const [documents, setDocuments] = useState<LegalDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [preview, setPreview] = useState<LegalDocRow | null>(null)
  const [signEmail, setSignEmail] = useState("")
  const [signing, setSigning] = useState(false)
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
      setPreview({
        ...json.document,
        preview: json.document.markdown?.slice(0, 200) ?? "",
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "generate_failed")
    } finally {
      setGenerating(null)
    }
  }

  async function publish(id: string) {
    setError(null)
    const res = await fetch("/api/legal/avocat/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, action: "publish" }),
    })
    if (!res.ok) setError("publish_failed")
    await load()
  }

  async function requestSign(doc: LegalDocRow) {
    if (!signEmail.trim()) {
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
          documentId: doc.id,
          email: signEmail.trim(),
          signerName: forms.contrat_fournisseur?.supplierName,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; signingUrl?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setLastSignUrl(data.signingUrl ?? null)
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
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(180,83,9,0.25),transparent)]"
        aria-hidden
      />
      <BentoShell className={cn("relative", LEGAL_COCKPIT_SHELL)}>
        <BentoContainer maxWidth="5xl" className="space-y-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BentoPageHeading
              className={LEGAL_COCKPIT_HEADING}
              eyebrow="Affisell · Conformité DSA"
              title="Documents légaux"
              description="CGV · CGU · Mentions · Contrats fournisseurs — génération GPT-4o + signature électronique."
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
                      <Icon className="size-4 text-amber-400" aria-hidden />
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
                      <p className={cn("mt-2 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>Génération automatique depuis identité Affisell.</p>
                    )}
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ size: "sm" }),
                        "mt-4 w-full gap-1.5 bg-gradient-to-r from-amber-700 to-amber-600"
                      )}
                      disabled={generating === card.type}
                      onClick={() => void generate(card.type)}
                    >
                      {generating === card.type ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Générer
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

          {preview ? (
            <BentoCard className={cn(LEGAL_COCKPIT_CARD, "border-amber-500/30")}>
              <p className="text-sm font-semibold text-amber-200">Preview — {preview.title}</p>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-amber-500/25 bg-zinc-950/90 p-4 text-xs text-amber-100/95">
                {preview.markdown ?? preview.preview}
              </pre>
            </BentoCard>
          ) : null}

          <BentoCard className={LEGAL_COCKPIT_CARD}>
            <p className={cn("text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>Versions</p>
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
                        <td className="px-4 py-3.5 text-xs font-semibold uppercase text-zinc-300">{doc.status}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "h-8 text-[11px]",
                                legalOutlineButtonClass()
                              )}
                              onClick={() =>
                                void fetch(`/api/legal/avocat/documents?id=${doc.id}`, { credentials: "include" })
                                  .then((r) => r.json())
                                  .then((j: { document?: LegalDocRow & { markdown: string } }) => {
                                    if (j.document) setPreview(j.document)
                                  })
                              }
                            >
                              Voir
                            </button>
                            {doc.status === "draft" ? (
                              <button
                                type="button"
                                className={cn(buttonVariants({ size: "sm" }), "h-7 text-[10px] bg-amber-800")}
                                onClick={() => void publish(doc.id)}
                              >
                                Publier
                              </button>
                            ) : null}
                            {doc.type === "contrat_fournisseur" && doc.status === "published" ? (
                              <button
                                type="button"
                                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-7 text-[10px]")}
                                disabled={signing}
                                onClick={() => void requestSign(doc)}
                              >
                                Signer
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-4">
              <label className={cn("text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
                Email signataire (contrat fournisseur)
                <input
                  className="mt-1 block w-64 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                  type="email"
                  placeholder="supplier@example.com"
                  value={signEmail}
                  onChange={(e) => setSignEmail(e.target.value)}
                />
              </label>
            </div>
          </BentoCard>
        </BentoContainer>
      </BentoShell>
    </div>
  )
}
